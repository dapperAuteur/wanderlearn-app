import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";

export type EnrollmentRow = typeof schema.enrollments.$inferSelect;

export async function getEnrollment(
  userId: string,
  courseId: string,
): Promise<EnrollmentRow | null> {
  const rows = await db
    .select()
    .from(schema.enrollments)
    .where(
      and(eq(schema.enrollments.userId, userId), eq(schema.enrollments.courseId, courseId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function hasActiveEnrollment(
  userId: string,
  courseId: string,
): Promise<boolean> {
  const row = await getEnrollment(userId, courseId);
  return row !== null && row.revokedAt === null;
}
