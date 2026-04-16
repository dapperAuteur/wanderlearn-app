import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";

export type LessonProgressRow = typeof schema.lessonProgress.$inferSelect;

export async function getLessonProgress(
  enrollmentId: string,
  lessonId: string,
): Promise<LessonProgressRow | null> {
  const rows = await db
    .select()
    .from(schema.lessonProgress)
    .where(
      and(
        eq(schema.lessonProgress.enrollmentId, enrollmentId),
        eq(schema.lessonProgress.lessonId, lessonId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listProgressForEnrollment(
  enrollmentId: string,
): Promise<LessonProgressRow[]> {
  return db
    .select()
    .from(schema.lessonProgress)
    .where(eq(schema.lessonProgress.enrollmentId, enrollmentId));
}

export async function getLatestInProgressLesson(
  enrollmentId: string,
): Promise<LessonProgressRow | null> {
  const rows = await db
    .select()
    .from(schema.lessonProgress)
    .where(
      and(
        eq(schema.lessonProgress.enrollmentId, enrollmentId),
        eq(schema.lessonProgress.status, "in_progress"),
      ),
    )
    .orderBy(desc(schema.lessonProgress.updatedAt))
    .limit(1);
  return rows[0] ?? null;
}
