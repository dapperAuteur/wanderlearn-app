"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { requireUser } from "@/lib/rbac";
import type { Locale } from "@/lib/locales";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

const enrollFreeSchema = z.object({
  courseId: z.string().uuid(),
  lang: z.enum(["en", "es"]),
});

export async function enrollFreeCourse(
  formData: FormData,
): Promise<Result<{ courseSlug: string }>> {
  const parsed = enrollFreeSchema.safeParse({
    courseId: String(formData.get("courseId") ?? ""),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireUser(parsed.data.lang);

  const [course] = await db
    .select({
      id: schema.courses.id,
      slug: schema.courses.slug,
      priceCents: schema.courses.priceCents,
      status: schema.courses.status,
    })
    .from(schema.courses)
    .where(eq(schema.courses.id, parsed.data.courseId))
    .limit(1);
  if (!course) {
    return { ok: false, error: "Course not found", code: "not_found" };
  }
  if (course.status !== "published") {
    return { ok: false, error: "Course is not published", code: "not_published" };
  }
  if (course.priceCents > 0) {
    return {
      ok: false,
      error: "Paid courses require checkout, not in this build yet",
      code: "paid_course",
    };
  }

  const [existing] = await db
    .select({ id: schema.enrollments.id })
    .from(schema.enrollments)
    .where(
      and(
        eq(schema.enrollments.userId, user.id),
        eq(schema.enrollments.courseId, course.id),
      ),
    )
    .limit(1);
  if (existing) {
    revalidatePath(`/${parsed.data.lang}/courses/${course.slug}`);
    return { ok: true, data: { courseSlug: course.slug } };
  }

  await db.insert(schema.enrollments).values({
    userId: user.id,
    courseId: course.id,
    source: "free",
  });

  revalidatePath(`/${parsed.data.lang}/courses/${course.slug}`);
  revalidatePath(`/${parsed.data.lang}/courses`);
  return { ok: true, data: { courseSlug: course.slug } };
}
