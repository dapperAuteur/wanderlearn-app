"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { requireUser } from "@/lib/rbac";
import type { Locale } from "@/lib/locales";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

const langSchema = z.enum(["en", "es"]);

const startSchema = z.object({
  enrollmentId: z.string().uuid(),
  lessonId: z.string().uuid(),
  courseSlug: z.string().min(1).max(200),
  lang: langSchema,
});

const completeSchema = startSchema;

async function assertOwnedEnrollment(enrollmentId: string, userId: string) {
  const [row] = await db
    .select({
      id: schema.enrollments.id,
      userId: schema.enrollments.userId,
      revokedAt: schema.enrollments.revokedAt,
    })
    .from(schema.enrollments)
    .where(eq(schema.enrollments.id, enrollmentId))
    .limit(1);
  if (!row || row.userId !== userId || row.revokedAt !== null) {
    return null;
  }
  return row;
}

async function assertLessonBelongsToEnrollment(lessonId: string, enrollmentId: string) {
  const [row] = await db
    .select({ lessonId: schema.lessons.id, courseId: schema.lessons.courseId })
    .from(schema.lessons)
    .innerJoin(schema.enrollments, eq(schema.enrollments.courseId, schema.lessons.courseId))
    .where(
      and(eq(schema.lessons.id, lessonId), eq(schema.enrollments.id, enrollmentId)),
    )
    .limit(1);
  return row ?? null;
}

export async function markLessonInProgress(
  formData: FormData,
): Promise<Result<{ lessonId: string }>> {
  const parsed = startSchema.safeParse({
    enrollmentId: String(formData.get("enrollmentId") ?? ""),
    lessonId: String(formData.get("lessonId") ?? ""),
    courseSlug: String(formData.get("courseSlug") ?? ""),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireUser(parsed.data.lang);

  const enrollment = await assertOwnedEnrollment(parsed.data.enrollmentId, user.id);
  if (!enrollment) {
    return { ok: false, error: "Enrollment not found", code: "not_found" };
  }
  const lesson = await assertLessonBelongsToEnrollment(
    parsed.data.lessonId,
    enrollment.id,
  );
  if (!lesson) {
    return { ok: false, error: "Lesson not in this enrollment's course", code: "wrong_course" };
  }

  const [existing] = await db
    .select({ id: schema.lessonProgress.id, status: schema.lessonProgress.status })
    .from(schema.lessonProgress)
    .where(
      and(
        eq(schema.lessonProgress.enrollmentId, enrollment.id),
        eq(schema.lessonProgress.lessonId, parsed.data.lessonId),
      ),
    )
    .limit(1);

  const now = new Date();
  if (!existing) {
    await db.insert(schema.lessonProgress).values({
      enrollmentId: enrollment.id,
      lessonId: parsed.data.lessonId,
      status: "in_progress",
      percentComplete: 0,
      startedAt: now,
      updatedAt: now,
    });
  } else if (existing.status !== "completed") {
    await db
      .update(schema.lessonProgress)
      .set({ updatedAt: now })
      .where(eq(schema.lessonProgress.id, existing.id));
  }

  revalidatePath(`/${parsed.data.lang}/courses/${parsed.data.courseSlug}`);
  return { ok: true, data: { lessonId: parsed.data.lessonId } };
}

export async function markLessonCompleted(
  formData: FormData,
): Promise<Result<{ lessonId: string }>> {
  const parsed = completeSchema.safeParse({
    enrollmentId: String(formData.get("enrollmentId") ?? ""),
    lessonId: String(formData.get("lessonId") ?? ""),
    courseSlug: String(formData.get("courseSlug") ?? ""),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireUser(parsed.data.lang);

  const enrollment = await assertOwnedEnrollment(parsed.data.enrollmentId, user.id);
  if (!enrollment) {
    return { ok: false, error: "Enrollment not found", code: "not_found" };
  }
  const lesson = await assertLessonBelongsToEnrollment(
    parsed.data.lessonId,
    enrollment.id,
  );
  if (!lesson) {
    return { ok: false, error: "Lesson not in this enrollment's course", code: "wrong_course" };
  }

  const now = new Date();
  const [existing] = await db
    .select({ id: schema.lessonProgress.id })
    .from(schema.lessonProgress)
    .where(
      and(
        eq(schema.lessonProgress.enrollmentId, enrollment.id),
        eq(schema.lessonProgress.lessonId, parsed.data.lessonId),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(schema.lessonProgress)
      .set({
        status: "completed",
        percentComplete: 100,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.lessonProgress.id, existing.id));
  } else {
    await db.insert(schema.lessonProgress).values({
      enrollmentId: enrollment.id,
      lessonId: parsed.data.lessonId,
      status: "completed",
      percentComplete: 100,
      startedAt: now,
      completedAt: now,
      updatedAt: now,
    });
  }

  revalidatePath(`/${parsed.data.lang}/courses/${parsed.data.courseSlug}`);
  return { ok: true, data: { lessonId: parsed.data.lessonId } };
}
