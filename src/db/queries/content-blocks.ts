import { and, asc, eq, max } from "drizzle-orm";
import { db, schema } from "@/db/client";

export type ContentBlockRow = typeof schema.contentBlocks.$inferSelect;

export async function listBlocksForLesson(lessonId: string): Promise<ContentBlockRow[]> {
  return db
    .select()
    .from(schema.contentBlocks)
    .where(eq(schema.contentBlocks.lessonId, lessonId))
    .orderBy(asc(schema.contentBlocks.orderIndex));
}

export async function getBlockById(id: string): Promise<ContentBlockRow | null> {
  const rows = await db
    .select()
    .from(schema.contentBlocks)
    .where(eq(schema.contentBlocks.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function nextBlockOrderIndex(lessonId: string): Promise<number> {
  const [row] = await db
    .select({ maxIndex: max(schema.contentBlocks.orderIndex) })
    .from(schema.contentBlocks)
    .where(eq(schema.contentBlocks.lessonId, lessonId));
  return (row?.maxIndex ?? -1) + 1;
}

export async function requireBlockOwnership(
  blockId: string,
  userId: string,
): Promise<{ block: ContentBlockRow; lessonId: string; courseId: string } | null> {
  const rows = await db
    .select({
      block: schema.contentBlocks,
      lessonId: schema.lessons.id,
      courseId: schema.courses.id,
      creatorId: schema.courses.creatorId,
    })
    .from(schema.contentBlocks)
    .innerJoin(schema.lessons, eq(schema.lessons.id, schema.contentBlocks.lessonId))
    .innerJoin(schema.courses, eq(schema.courses.id, schema.lessons.courseId))
    .where(
      and(eq(schema.contentBlocks.id, blockId), eq(schema.courses.creatorId, userId)),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { block: row.block, lessonId: row.lessonId, courseId: row.courseId };
}

export async function requireLessonOwnership(
  lessonId: string,
  userId: string,
): Promise<{ lessonId: string; courseId: string } | null> {
  const rows = await db
    .select({
      lessonId: schema.lessons.id,
      courseId: schema.courses.id,
      creatorId: schema.courses.creatorId,
    })
    .from(schema.lessons)
    .innerJoin(schema.courses, eq(schema.courses.id, schema.lessons.courseId))
    .where(
      and(eq(schema.lessons.id, lessonId), eq(schema.courses.creatorId, userId)),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { lessonId: row.lessonId, courseId: row.courseId };
}
