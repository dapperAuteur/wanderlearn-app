/**
 * Liveness endpoint for external uptime monitors (Better Stack et al).
 *
 * Why this exists: monitors pointed at `/` can get a 200 straight from the CDN
 * while the database is face down, so the green check means nothing. This route
 * really opens a connection and runs the cheapest possible query, so a 200 here
 * means the app process AND its database are both answering right now.
 *
 * Contract (public, unauthenticated, deliberately boring):
 *   200 {"ok":true,"checks":{"db":"ok"}}
 *   503 {"ok":false,"error":"database_unreachable"}
 *
 * It leaks nothing on failure: no version, no env values, no row counts, no
 * user data, and above all no driver error text. The connection string lives in
 * the message of most Neon/pg failures, so the `catch` below is written WITHOUT
 * a binding: the error object is unreachable by construction, the response body
 * is a fixed literal, and the log line is a constant string. Adding `(err)` here
 * and logging `err.message` would just move the leak from the response into the
 * log sink.
 */

// Never prerendered, never revalidated, never cached at any layer. A cached
// health check is the exact failure this endpoint was built to prevent.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// A monitor that waits forever is a monitor that reports "up" while the
// database hangs. Fail loudly instead: 4s is comfortably above a cold Neon
// connection and well under Better Stack's default request timeout.
const PROBE_TIMEOUT_MS = 4_000;

const HEALTH_HEADERS: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
};

function healthy(): Response {
  return new Response(JSON.stringify({ ok: true, checks: { db: "ok" } }), {
    status: 200,
    headers: HEALTH_HEADERS,
  });
}

function unhealthy(): Response {
  return new Response(
    JSON.stringify({ ok: false, error: "database_unreachable" }),
    { status: 503, headers: HEALTH_HEADERS },
  );
}

async function checkDatabase(): Promise<Response> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    // Imported dynamically, INSIDE the try, on purpose. `@/db/client` pulls in
    // `@/lib/env`, which throws on a missing or malformed DATABASE_URL, and the
    // Neon pool constructor can throw too. A static top-level import would make
    // either of those a module-evaluation crash: a 500 whose stack trace can
    // quote the connection string. Here they are ordinary rejections that land
    // in the bindingless catch below and come back as a clean 503.
    const probe = (async () => {
      const [{ db }, { sql }] = await Promise.all([
        import("@/db/client"),
        import("drizzle-orm"),
      ]);
      // Cheapest liveness query there is. No table, no plan, no data returned;
      // it proves only that a connection was established and the server
      // answered, which is exactly the question being asked.
      await db.execute(sql`select 1`);
    })();

    // If the timeout wins the race, nothing is listening to `probe` any more.
    // A no-op handler keeps its eventual rejection from surfacing as an
    // unhandled rejection that Sentry reports (or that kills the runtime).
    probe.catch(() => {});

    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error("health probe timed out"));
      }, PROBE_TIMEOUT_MS);
    });
    // Same reasoning in the other direction: if the probe wins, this rejection
    // is still pending and needs an owner.
    timeout.catch(() => {});

    await Promise.race([probe, timeout]);
    return healthy();
  } catch {
    // No binding. Fixed literal response, constant log string. Nothing derived
    // from the error can reach a caller or a log sink.
    console.error("[health] database liveness probe failed");
    return unhealthy();
  } finally {
    // Runs on both paths. Without it a successful check would hold a pending
    // timer for the full 4s and keep the function instance awake.
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function GET(): Promise<Response> {
  return checkDatabase();
}

/**
 * Some monitors probe with HEAD to save bandwidth. Without an explicit handler
 * Next answers 405, which reads as "down" on a checker that only looks at the
 * status code. Same real check, same status, no body.
 */
export async function HEAD(): Promise<Response> {
  const result = await checkDatabase();
  return new Response(null, { status: result.status, headers: HEALTH_HEADERS });
}
