import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";

export type CourseTranslationRow = typeof schema.courseTranslations.$inferSelect;
export type LessonTranslationRow = typeof schema.lessonTranslations.$inferSelect;
export type ContentBlockTranslationRow =
  typeof schema.contentBlockTranslations.$inferSelect;

export async function getCourseTranslation(
  courseId: string,
  locale: string,
): Promise<CourseTranslationRow | null> {
  const rows = await db
    .select()
    .from(schema.courseTranslations)
    .where(
      and(
        eq(schema.courseTranslations.courseId, courseId),
        eq(schema.courseTranslations.locale, locale),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listCourseTranslationsByIds(
  courseIds: string[],
  locale: string,
): Promise<Map<string, CourseTranslationRow>> {
  const map = new Map<string, CourseTranslationRow>();
  if (courseIds.length === 0) return map;
  const rows = await db
    .select()
    .from(schema.courseTranslations)
    .where(
      and(
        inArray(schema.courseTranslations.courseId, courseIds),
        eq(schema.courseTranslations.locale, locale),
      ),
    );
  for (const r of rows) map.set(r.courseId, r);
  return map;
}

export async function listLessonTranslationsByIds(
  lessonIds: string[],
  locale: string,
): Promise<Map<string, LessonTranslationRow>> {
  const map = new Map<string, LessonTranslationRow>();
  if (lessonIds.length === 0) return map;
  const rows = await db
    .select()
    .from(schema.lessonTranslations)
    .where(
      and(
        inArray(schema.lessonTranslations.lessonId, lessonIds),
        eq(schema.lessonTranslations.locale, locale),
      ),
    );
  for (const r of rows) map.set(r.lessonId, r);
  return map;
}

export async function listContentBlockTranslationsByIds(
  blockIds: string[],
  locale: string,
): Promise<Map<string, ContentBlockTranslationRow>> {
  const map = new Map<string, ContentBlockTranslationRow>();
  if (blockIds.length === 0) return map;
  const rows = await db
    .select()
    .from(schema.contentBlockTranslations)
    .where(
      and(
        inArray(schema.contentBlockTranslations.blockId, blockIds),
        eq(schema.contentBlockTranslations.locale, locale),
      ),
    );
  for (const r of rows) map.set(r.blockId, r);
  return map;
}
