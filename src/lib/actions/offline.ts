"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { requireUser } from "@/lib/rbac";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

const langSchema = z.enum(["en", "es"]);

const toggleSchema = z.object({
  courseId: z.string().uuid(),
  courseSlug: z.string().min(1).max(200),
  enabled: z.boolean(),
  lang: langSchema,
});

export async function toggleCourseOfflineEnabled(
  formData: FormData,
): Promise<Result<{ courseId: string; enabled: boolean }>> {
  const parsed = toggleSchema.safeParse({
    courseId: String(formData.get("courseId") ?? ""),
    courseSlug: String(formData.get("courseSlug") ?? ""),
    enabled: String(formData.get("enabled") ?? "false") === "true",
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireUser(parsed.data.lang);

  const [enrollment] = await db
    .select({ id: schema.enrollments.id, revokedAt: schema.enrollments.revokedAt })
    .from(schema.enrollments)
    .where(
      and(
        eq(schema.enrollments.userId, user.id),
        eq(schema.enrollments.courseId, parsed.data.courseId),
      ),
    )
    .limit(1);
  if (!enrollment || enrollment.revokedAt !== null) {
    return { ok: false, error: "Not enrolled", code: "not_enrolled" };
  }

  await db
    .update(schema.enrollments)
    .set({ offlineEnabledAt: parsed.data.enabled ? new Date() : null })
    .where(eq(schema.enrollments.id, enrollment.id));

  revalidatePath(`/${parsed.data.lang}/courses/${parsed.data.courseSlug}`);
  return {
    ok: true,
    data: { courseId: parsed.data.courseId, enabled: parsed.data.enabled },
  };
}
