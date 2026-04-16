"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { nextOrderIndexFor } from "@/db/queries/lessons";
import { requireCreator } from "@/lib/rbac";
import { slugify } from "@/lib/slug";
import type { Locale } from "@/lib/locales";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

const langSchema = z.enum(["en", "es"]);
const statusSchema = z.enum(["draft", "published"]);

const createSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  summary: z.string().max(1000).optional(),
  status: statusSchema,
  isFreePreview: z.boolean(),
  estimatedMinutes: z.coerce.number().int().min(0).max(600).optional(),
  orderIndex: z.coerce.number().int().min(0).max(999).optional(),
  lang: langSchema,
});

const updateSchema = createSchema.extend({
  id: z.string().uuid(),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
  courseId: z.string().uuid(),
  lang: langSchema,
});

function parseBool(v: FormDataEntryValue | null): boolean {
  return v === "1" || v === "true" || v === "on";
}

function parseFormData(formData: FormData) {
  const minutesRaw = String(formData.get("estimatedMinutes") ?? "").trim();
  const orderRaw = String(formData.get("orderIndex") ?? "").trim();
  return {
    courseId: String(formData.get("courseId") ?? ""),
    title: String(formData.get("title") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim() || undefined,
    summary: String(formData.get("summary") ?? "").trim() || undefined,
    status: String(formData.get("status") ?? "draft") as "draft" | "published",
    isFreePreview: parseBool(formData.get("isFreePreview")),
    estimatedMinutes: minutesRaw ? Number(minutesRaw) : undefined,
    orderIndex: orderRaw ? Number(orderRaw) : undefined,
    lang: String(formData.get("lang") ?? "en") as Locale,
  };
}

async function requireCourseOwnership(courseId: string, userId: string) {
  const [row] = await db
    .select({ id: schema.courses.id })
    .from(schema.courses)
    .where(and(eq(schema.courses.id, courseId), eq(schema.courses.creatorId, userId)))
    .limit(1);
  return row ?? null;
}

export async function createLesson(formData: FormData): Promise<Result<{ id: string }>> {
  const parsed = createSchema.safeParse(parseFormData(formData));
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  const course = await requireCourseOwnership(parsed.data.courseId, user.id);
  if (!course) {
    return { ok: false, error: "Course not found", code: "course_not_found" };
  }

  const slug = parsed.data.slug ?? slugify(parsed.data.title);
  if (!slug) {
    return { ok: false, error: "Title is too short for a slug", code: "invalid_slug" };
  }

  const [existing] = await db
    .select({ id: schema.lessons.id })
    .from(schema.lessons)
    .where(
      and(eq(schema.lessons.courseId, parsed.data.courseId), eq(schema.lessons.slug, slug)),
    )
    .limit(1);
  if (existing) {
    return { ok: false, error: "A lesson with that slug already exists", code: "slug_taken" };
  }

  const orderIndex = parsed.data.orderIndex ?? (await nextOrderIndexFor(parsed.data.courseId));

  const [row] = await db
    .insert(schema.lessons)
    .values({
      courseId: parsed.data.courseId,
      slug,
      orderIndex,
      title: parsed.data.title,
      summary: parsed.data.summary,
      status: parsed.data.status,
      isFreePreview: parsed.data.isFreePreview,
      estimatedMinutes: parsed.data.estimatedMinutes,
    })
    .returning({ id: schema.lessons.id });

  if (!row) {
    return { ok: false, error: "Failed to create lesson", code: "db_insert_failed" };
  }

  revalidatePath(`/${parsed.data.lang}/creator/courses/${parsed.data.courseId}`);
  return { ok: true, data: { id: row.id } };
}

export async function updateLesson(formData: FormData): Promise<Result<{ id: string }>> {
  const body = { ...parseFormData(formData), id: String(formData.get("id") ?? "") };
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  const course = await requireCourseOwnership(parsed.data.courseId, user.id);
  if (!course) {
    return { ok: false, error: "Course not found", code: "course_not_found" };
  }

  const [existing] = await db
    .select({ id: schema.lessons.id, currentOrderIndex: schema.lessons.orderIndex })
    .from(schema.lessons)
    .where(
      and(eq(schema.lessons.id, parsed.data.id), eq(schema.lessons.courseId, parsed.data.courseId)),
    )
    .limit(1);
  if (!existing) {
    return { ok: false, error: "Lesson not found", code: "not_found" };
  }

  const slug = parsed.data.slug ?? slugify(parsed.data.title);

  if (slug !== undefined) {
    const [slugClash] = await db
      .select({ id: schema.lessons.id })
      .from(schema.lessons)
      .where(
        and(
          eq(schema.lessons.courseId, parsed.data.courseId),
          eq(schema.lessons.slug, slug),
        ),
      )
      .limit(1);
    if (slugClash && slugClash.id !== parsed.data.id) {
      return { ok: false, error: "Slug already used", code: "slug_taken" };
    }
  }

  await db
    .update(schema.lessons)
    .set({
      slug,
      title: parsed.data.title,
      summary: parsed.data.summary,
      status: parsed.data.status,
      isFreePreview: parsed.data.isFreePreview,
      estimatedMinutes: parsed.data.estimatedMinutes,
      orderIndex: parsed.data.orderIndex ?? existing.currentOrderIndex,
      updatedAt: new Date(),
    })
    .where(eq(schema.lessons.id, parsed.data.id));

  revalidatePath(`/${parsed.data.lang}/creator/courses/${parsed.data.courseId}`);
  revalidatePath(
    `/${parsed.data.lang}/creator/courses/${parsed.data.courseId}/lessons/${parsed.data.id}`,
  );
  return { ok: true, data: { id: parsed.data.id } };
}

export async function deleteLesson(formData: FormData): Promise<Result<null>> {
  const parsed = deleteSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    courseId: String(formData.get("courseId") ?? ""),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  const course = await requireCourseOwnership(parsed.data.courseId, user.id);
  if (!course) {
    return { ok: false, error: "Course not found", code: "course_not_found" };
  }

  await db
    .delete(schema.lessons)
    .where(
      and(eq(schema.lessons.id, parsed.data.id), eq(schema.lessons.courseId, parsed.data.courseId)),
    );

  revalidatePath(`/${parsed.data.lang}/creator/courses/${parsed.data.courseId}`);
  return { ok: true, data: null };
}
