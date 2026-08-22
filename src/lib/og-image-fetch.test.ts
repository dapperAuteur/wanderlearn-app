import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchImageAsDataUri } from "./og-image-fetch";

/**
 * Every case here is a way the share card can lose its photograph. The point
 * of the helper is that all of them degrade to the text-only card instead of
 * throwing — because a throw happens inside Satori's render and 500s the whole
 * route, turning "plainer preview" into "no preview at all".
 */
function respondWith(init: { ok: boolean; type?: string; body?: Uint8Array }) {
  return vi.fn().mockResolvedValue({
    ok: init.ok,
    headers: { get: (h: string) => (h === "content-type" ? (init.type ?? null) : null) },
    arrayBuffer: async () => (init.body ?? new Uint8Array()).buffer,
  } as unknown as Response);
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchImageAsDataUri", () => {
  it("returns a data URI for a real image", async () => {
    vi.stubGlobal("fetch", respondWith({ ok: true, type: "image/jpeg", body: new Uint8Array([1, 2, 3]) }));
    await expect(fetchImageAsDataUri("https://example.test/a.jpg")).resolves.toMatch(
      /^data:image\/jpeg;base64,/,
    );
  });

  it("returns null on a 404", async () => {
    vi.stubGlobal("fetch", respondWith({ ok: false, type: "image/gif" }));
    await expect(fetchImageAsDataUri("https://example.test/missing.jpg")).resolves.toBeNull();
  });

  it("returns null when the body is not an image", async () => {
    // Cloudinary answers a missing asset with image/gif, so status is checked
    // first — but a JSON error page with a 200 is exactly what would sail
    // through into Satori and throw there.
    vi.stubGlobal("fetch", respondWith({ ok: true, type: "application/json", body: new Uint8Array([1]) }));
    await expect(fetchImageAsDataUri("https://example.test/oops")).resolves.toBeNull();
  });

  it("returns null on an empty body", async () => {
    vi.stubGlobal("fetch", respondWith({ ok: true, type: "image/jpeg", body: new Uint8Array() }));
    await expect(fetchImageAsDataUri("https://example.test/empty.jpg")).resolves.toBeNull();
  });

  it("returns null when the fetch rejects (timeout, DNS, TLS)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("The operation was aborted")));
    await expect(fetchImageAsDataUri("https://example.test/slow.jpg")).resolves.toBeNull();
  });

  it("never throws, whatever fetch does", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => { throw new Error("sync boom"); }));
    await expect(fetchImageAsDataUri("https://example.test/x.jpg")).resolves.toBeNull();
  });

  it("bounds the request with a timeout signal", async () => {
    const spy = respondWith({ ok: true, type: "image/png", body: new Uint8Array([9]) });
    vi.stubGlobal("fetch", spy);
    await fetchImageAsDataUri("https://example.test/a.png");
    // A crawler is waiting on this render; an unbounded fetch holds the card
    // hostage for as long as the CDN feels like taking.
    expect(spy.mock.calls[0]?.[1]).toHaveProperty("signal");
  });
});
