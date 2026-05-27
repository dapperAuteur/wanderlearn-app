import { and, eq, isNotNull, lt } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { db, schema } from "@/db/client";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Single Vercel cron handler. Per BAM's call (hobby tier = 1 cron) we
 * dispatch every periodic job from this one route. Add new tasks below
 * as `await runX()` calls and they'll all fire on the same 09:00 UTC
 * schedule (configured in vercel.json).
 *
 * Auth: Vercel injects `Authorization: Bearer <CRON_SECRET>`. We also
 * accept `?secret=…` for local curl testing.
 */
async function authorize(request: Request): Promise<boolean> {
  if (!env.CRON_SECRET) {
    // Refuse in any environment when the secret isn't configured.
    // Local dev: set CRON_SECRET in .env.local to run the job by hand.
    return false;
  }
  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader === `Bearer ${env.CRON_SECRET}`) return true;
  const url = new URL(request.url);
  if (url.searchParams.get("secret") === env.CRON_SECRET) return true;
  return false;
}

/**
 * Close threads the user confirmed positively at least 14 days ago.
 * Disputed threads went back to `waiting_admin` at confirmation time,
 * so they're not in scope here — only the contentedly-resolved ones
 * age out automatically.
 */
async function closeStaleResolvedThreads(): Promise<{ closed: number }> {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const result = await db
    .update(schema.supportThreads)
    .set({
      status: "closed",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.supportThreads.status, "resolved_user_confirmed"),
        isNotNull(schema.supportThreads.userConfirmedAt),
        lt(schema.supportThreads.userConfirmedAt, cutoff),
      ),
    )
    .returning({ id: schema.supportThreads.id });
  return { closed: result.length };
}

export async function GET(request: Request) {
  if (!(await authorize(request))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const startedAt = new Date();
  const results: Record<string, unknown> = {};
  const errors: string[] = [];

  try {
    results.closeStaleResolvedThreads = await closeStaleResolvedThreads();
  } catch (error) {
    console.error("[cron/daily] closeStaleResolvedThreads failed", error);
    errors.push(`closeStaleResolvedThreads: ${(error as Error).message}`);
  }

  // Bust the satisfaction-metric cache so the next pageview reflects
  // any state changes we just made. Next 16's revalidateTag requires
  // a profile/CacheLifeConfig — `{ expire: 0 }` invalidates now.
  revalidateTag("bug-satisfaction-metric", { expire: 0 });

  return Response.json({
    ok: errors.length === 0,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    results,
    errors,
  });
}

