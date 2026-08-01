import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The point of these tests is not "does it return 200". It is the promise the
 * endpoint makes to anyone who can curl it: on failure the body and the logs
 * say `database_unreachable` and nothing else. A regression here is a credential
 * leak on a public, unauthenticated URL, which is exactly the kind of thing that
 * survives code review because the happy path still looks fine.
 */

// Stand-in for the real connection string. If any assertion below finds this
// substring in a response body or a log argument, the endpoint is leaking.
const SECRET = "postgresql://user:hunter2@ep-secret-123.us-east-2.aws.neon.tech/db";

const execute = vi.fn();

vi.mock("@/db/client", () => ({
  get db() {
    return { execute };
  },
}));

beforeEach(() => {
  execute.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("GET /api/health", () => {
  it("returns 200 with the db check when the query succeeds", async () => {
    execute.mockResolvedValue({ rows: [{ "?column?": 1 }] });
    const { GET } = await import("./route");

    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, checks: { db: "ok" } });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("never caches, at any layer", async () => {
    execute.mockResolvedValue({ rows: [] });
    const { GET } = await import("./route");

    const res = await GET();

    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("returns 503 with a fixed body when the query throws", async () => {
    execute.mockRejectedValue(new Error(`connect ECONNREFUSED ${SECRET}`));
    const { GET } = await import("./route");

    const res = await GET();
    const body = await res.text();

    expect(res.status).toBe(503);
    expect(JSON.parse(body)).toEqual({ ok: false, error: "database_unreachable" });
    // The driver error text is not in the response, in any form.
    expect(body).not.toContain(SECRET);
    expect(body).not.toContain("hunter2");
    expect(body).not.toContain("ECONNREFUSED");
  });

  it("logs a constant string, never the error", async () => {
    execute.mockRejectedValue(new Error(`connect ECONNREFUSED ${SECRET}`));
    const { GET } = await import("./route");

    await GET();

    // Logging `err.message` would move the leak from the response into the log
    // sink, which is worse: it looks safe and ships the secret anyway.
    const logged = vi.mocked(console.error).mock.calls.flat().map(String).join(" ");
    expect(logged).not.toContain(SECRET);
    expect(logged).not.toContain("hunter2");
    expect(logged).toContain("[health] database liveness probe failed");
  });

  it("returns 503 when the probe hangs past the timeout", async () => {
    vi.useFakeTimers();
    // A connection that never answers is the failure mode a naive health check
    // gets wrong: it hangs, the monitor times out its own request, and the
    // dashboard shows an ambiguous error instead of "down".
    execute.mockReturnValue(new Promise(() => {}));
    const { GET } = await import("./route");

    const pending = GET();
    await vi.advanceTimersByTimeAsync(4_000);
    const res = await pending;

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: "database_unreachable",
    });
  });
});

describe("HEAD /api/health", () => {
  it("mirrors the GET status with no body", async () => {
    execute.mockResolvedValue({ rows: [] });
    const { HEAD } = await import("./route");

    const res = await HEAD();

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it("reports 503 too, so a HEAD monitor sees the outage", async () => {
    execute.mockRejectedValue(new Error("boom"));
    const { HEAD } = await import("./route");

    const res = await HEAD();

    expect(res.status).toBe(503);
  });
});
