import { asc, desc, eq, inArray } from "drizzle-orm";
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
  options?: { status?: (typeof schema.supportThreadStatus.enumValues)[number] },
): Promise<SupportThreadRow[]> {
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
