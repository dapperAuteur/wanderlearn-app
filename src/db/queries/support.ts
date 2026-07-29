import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db/client";

export type SupportThreadRow = typeof schema.supportThreads.$inferSelect;
export type SupportMessageRow = typeof schema.supportMessages.$inferSelect;

export async function getThreadById(threadId: string): Promise<SupportThreadRow | null> {
  const rows = await db
    .select()
    .from(schema.supportThreads)
    .where(eq(schema.supportThreads.id, threadId))
    .limit(1);
  return rows[0] ?? null;
}

export async function listThreadsForUser(userId: string): Promise<SupportThreadRow[]> {
  return db
    .select()
    .from(schema.supportThreads)
    .where(eq(schema.supportThreads.userId, userId))
    .orderBy(desc(schema.supportThreads.lastMessageAt));
}

export async function listAllThreads(
  options?: {
    status?: (typeof schema.supportThreadStatus.enumValues)[number];
    /**
     * When true, return only threads the user disputed (userConfirmedPositive
     * was set to false). These are the ones that came back from a resolved
     * state because the fix didn't actually hold; admin attention required.
     */
    disputedOnly?: boolean;
  },
): Promise<SupportThreadRow[]> {
  if (options?.disputedOnly) {
    return db
      .select()
      .from(schema.supportThreads)
      .where(eq(schema.supportThreads.userConfirmedPositive, false))
      .orderBy(desc(schema.supportThreads.lastMessageAt));
  }
  if (options?.status) {
    return db
      .select()
      .from(schema.supportThreads)
      .where(eq(schema.supportThreads.status, options.status))
      .orderBy(desc(schema.supportThreads.lastMessageAt));
  }
  return db
    .select()
    .from(schema.supportThreads)
    .orderBy(desc(schema.supportThreads.lastMessageAt));
}

export async function listMessagesForThread(threadId: string): Promise<SupportMessageRow[]> {
  return db
    .select()
    .from(schema.supportMessages)
    .where(eq(schema.supportMessages.threadId, threadId))
    .orderBy(asc(schema.supportMessages.createdAt));
}

export async function listAuthorNames(
  authorIds: string[],
): Promise<Map<string, { name: string | null; email: string | null }>> {
  const map = new Map<string, { name: string | null; email: string | null }>();
  if (authorIds.length === 0) return map;
  const rows = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
    })
    .from(schema.users)
    .where(inArray(schema.users.id, authorIds));
  for (const r of rows) {
    map.set(r.id, { name: r.name ?? null, email: r.email ?? null });
  }
  return map;
}

export async function countOpenThreads(): Promise<number> {
  const rows = await db
    .select({ id: schema.supportThreads.id })
    .from(schema.supportThreads)
    .where(eq(schema.supportThreads.status, "open"));
  return rows.length;
}

/**
 * Admin replies the user has not seen yet, across all their threads.
 *
 * The confirm-or-dispute resolution loop depends on people coming back to a thread
 * after we answer, and until now nothing told them there was anything to come back to.
 * `seen_by_user_at` has existed since the support schema landed and was already being
 * written by markThreadSeen — it was simply never read.
 *
 * Counts messages rather than threads: "3 new replies" is more actionable than
 * "2 threads have activity", and one thread can accumulate several.
 */
export async function countUnreadAdminMessagesForUser(userId: string): Promise<number> {
  const rows = await db
    .select({ id: schema.supportMessages.id })
    .from(schema.supportMessages)
    .innerJoin(
      schema.supportThreads,
      eq(schema.supportThreads.id, schema.supportMessages.threadId),
    )
    .where(
      and(
        eq(schema.supportThreads.userId, userId),
        eq(schema.supportMessages.authorRole, "admin"),
        isNull(schema.supportMessages.seenByUserAt),
      ),
    );
  return rows.length;
}
