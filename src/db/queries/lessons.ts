import { and, asc, eq, max } from "drizzle-orm";
import { db, schema } from "@/db/client";

export type LessonRow = typeof schema.lessons.$inferSelect;

export async function listLessonsForCourse(courseId: string): Promise<LessonRow[]> {
  return db
    .select()
    .from(schema.lessons)
    .where(eq(schema.lessons.courseId, courseId))
    .orderBy(asc(schema.lessons.orderIndex));
}

export async function getLessonById(id: string): Promise<LessonRow | null> {
  const rows = await db
    .select()
    .from(schema.lessons)
    .where(eq(schema.lessons.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getLessonByCourseAndSlug(
  courseId: string,
  slug: string,
): Promise<LessonRow | null> {
  const rows = await db
    .select()
    .from(schema.lessons)
    .where(and(eq(schema.lessons.courseId, courseId), eq(schema.lessons.slug, slug)))
    .limit(1);
  return rows[0] ?? null;
}

export async function nextOrderIndexFor(courseId: string): Promise<number> {
  const [row] = await db
    .select({ maxIndex: max(schema.lessons.orderIndex) })
    .from(schema.lessons)
    .where(eq(schema.lessons.courseId, courseId));
  return (row?.maxIndex ?? -1) + 1;
}
