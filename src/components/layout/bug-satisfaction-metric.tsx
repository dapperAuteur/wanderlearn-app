import { unstable_cache } from "next/cache";
import { and, gte, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";

export type BugSatisfactionMetricDict = {
  positive: string;
  empty: string;
};

/**
 * Aggregated 90-day support-thread satisfaction snapshot.
 *
 * Returned shape:
 *   - total: number of threads with a non-null userConfirmedPositive in the window
 *   - positive: number of those that were userConfirmedPositive = true
 *
 * Cached for one hour via unstable_cache. The window slides naturally each
 * time the cache misses, so we don't need an explicit invalidation tag.
 */
const fetchSatisfactionSnapshot = unstable_cache(
  async (): Promise<{ total: number; positive: number }> => {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        total: sql<number>`count(*)::int`,
        positive: sql<number>`count(*) filter (where ${schema.supportThreads.userConfirmedPositive} = true)::int`,
      })
      .from(schema.supportThreads)
      .where(
        and(
          isNotNull(schema.supportThreads.userConfirmedPositive),
          gte(schema.supportThreads.userConfirmedAt, cutoff),
        ),
      );
    const row = rows[0];
    return {
      total: row?.total ?? 0,
      positive: row?.positive ?? 0,
    };
  },
  ["bug-satisfaction-90d-snapshot"],
  { revalidate: 3600, tags: ["bug-satisfaction-metric"] },
);

export async function BugSatisfactionMetric({ dict }: { dict: BugSatisfactionMetricDict }) {
  const { total, positive } = await fetchSatisfactionSnapshot();
  if (total === 0) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{dict.empty}</p>
    );
  }
  const pct = Math.round((positive * 100) / total);
  return (
    <p className="text-xs text-zinc-500 dark:text-zinc-400">
      {dict.positive.replace("{pct}", String(pct))}
    </p>
  );
}
