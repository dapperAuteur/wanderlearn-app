import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";

export type CourseRow = typeof schema.courses.$inferSelect;

export async function listCoursesForCreator(creatorId: string): Promise<CourseRow[]> {
  return db
    .select()
    .from(schema.courses)
    .where(eq(schema.courses.creatorId, creatorId))
    .orderBy(desc(schema.courses.createdAt));
}

export async function getCourseById(id: string): Promise<CourseRow | null> {
  const rows = await db
    .select()
    .from(schema.courses)
    .where(eq(schema.courses.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCourseBySlug(slug: string): Promise<CourseRow | null> {
  const rows = await db
    .select()
    .from(schema.courses)
    .where(eq(schema.courses.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}
