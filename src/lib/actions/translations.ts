"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { getCourseById } from "@/db/queries/courses";
import {
  requireBlockOwnership,
  requireLessonOwnership,
} from "@/db/queries/content-blocks";
import { requireCreator } from "@/lib/rbac";
import type { TextBlockData } from "@/lib/actions/content-blocks";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

const langSchema = z.enum(["en", "es"]);
const localeSchema = z.enum(["en", "es"]);

async function requireCourseOwnership(
  courseId: string,
  userId: string,
): Promise<{ courseId: string; defaultLocale: string } | null> {
  const course = await getCourseById(courseId);
  if (!course) return null;
  if (course.creatorId !== userId) return null;
  return { courseId: course.id, defaultLocale: course.defaultLocale };
}

function revalidateCoursePaths(lang: string, courseId: string) {
  revalidatePath(`/${lang}/creator/courses/${courseId}`);
  revalidatePath(`/${lang}/creator/courses/${courseId}/translations`, "page");
}

// ---- course ---------------------------------------------------------

const upsertCourseTranslationSchema = z.object({
  courseId: z.string().uuid(),
  locale: localeSchema,
  title: z.string().min(1).max(200),
  subtitle: z.string().max(500).optional(),
  description: z.string().max(20_000).optional(),
  lang: langSchema,
});

export async function upsertCourseTranslation(
  formData: FormData,
): Promise<Result<{ courseId: string; locale: string }>> {
  const parsed = upsertCourseTranslationSchema.safeParse({
    courseId: String(formData.get("courseId") ?? ""),
    locale: String(formData.get("locale") ?? ""),
    title: String(formData.get("title") ?? "").trim(),
    subtitle: String(formData.get("subtitle") ?? "").trim() || undefined,
    description: String(formData.get("description") ?? "").trim() || undefined,
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);
  const ownership = await requireCourseOwnership(parsed.data.courseId, user.id);
  if (!ownership) {
    return { ok: false, error: "Course not found", code: "not_found" };
  }
  if (ownership.defaultLocale === parsed.data.locale) {
    return {
      ok: false,
      error: "Edit the source course page to change default-locale content.",
      code: "cannot_translate_to_default",
    };
  }

  const [existing] = await db
    .select({ id: schema.courseTranslations.id })
    .from(schema.courseTranslations)
    .where(
      and(
        eq(schema.courseTranslations.courseId, parsed.data.courseId),
        eq(schema.courseTranslations.locale, parsed.data.locale),
      ),
    )
    .limit(1);

  const values = {
    title: parsed.data.title,
    subtitle: parsed.data.subtitle ?? null,
    description: parsed.data.description ?? null,
  };

  if (existing) {
    await db
      .update(schema.courseTranslations)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(schema.courseTranslations.id, existing.id));
  } else {
    await db
      .insert(schema.courseTranslations)
      .values({ courseId: parsed.data.courseId, locale: parsed.data.locale, ...values });
  }

  revalidateCoursePaths(parsed.data.lang, parsed.data.courseId);
  return { ok: true, data: { courseId: parsed.data.courseId, locale: parsed.data.locale } };
}

// ---- lesson ---------------------------------------------------------

const upsertLessonTranslationSchema = z.object({
  lessonId: z.string().uuid(),
  locale: localeSchema,
  title: z.string().min(1).max(200),
  summary: z.string().max(2000).optional(),
  lang: langSchema,
});

export async function upsertLessonTranslation(
  formData: FormData,
): Promise<Result<{ lessonId: string; locale: string }>> {
  const parsed = upsertLessonTranslationSchema.safeParse({
    lessonId: String(formData.get("lessonId") ?? ""),
    locale: String(formData.get("locale") ?? ""),
    title: String(formData.get("title") ?? "").trim(),
    summary: String(formData.get("summary") ?? "").trim() || undefined,
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);
  const ownership = await requireLessonOwnership(parsed.data.lessonId, user.id);
  if (!ownership) {
    return { ok: false, error: "Lesson not found", code: "not_found" };
  }
  const course = await getCourseById(ownership.courseId);
  if (!course) {
    return { ok: false, error: "Course not found", code: "not_found" };
  }
  if (course.defaultLocale === parsed.data.locale) {
    return {
      ok: false,
      error: "Edit the source lesson to change default-locale content.",
      code: "cannot_translate_to_default",
    };
  }

  const [existing] = await db
    .select({ id: schema.lessonTranslations.id })
    .from(schema.lessonTranslations)
    .where(
      and(
        eq(schema.lessonTranslations.lessonId, parsed.data.lessonId),
        eq(schema.lessonTranslations.locale, parsed.data.locale),
      ),
    )
    .limit(1);

  const values = {
    title: parsed.data.title,
    summary: parsed.data.summary ?? null,
  };

  if (existing) {
    await db
      .update(schema.lessonTranslations)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(schema.lessonTranslations.id, existing.id));
  } else {
    await db
      .insert(schema.lessonTranslations)
      .values({ lessonId: parsed.data.lessonId, locale: parsed.data.locale, ...values });
  }

  revalidateCoursePaths(parsed.data.lang, ownership.courseId);
  return { ok: true, data: { lessonId: parsed.data.lessonId, locale: parsed.data.locale } };
}

// ---- block (text only for v1) ---------------------------------------

const upsertTextBlockTranslationSchema = z.object({
  blockId: z.string().uuid(),
  locale: localeSchema,
  markdown: z.string().min(1).max(20_000),
  lang: langSchema,
});

export async function upsertTextBlockTranslation(
  formData: FormData,
): Promise<Result<{ blockId: string; locale: string }>> {
  const parsed = upsertTextBlockTranslationSchema.safeParse({
    blockId: String(formData.get("blockId") ?? ""),
    locale: String(formData.get("locale") ?? ""),
    markdown: String(formData.get("markdown") ?? ""),
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);
  const ownership = await requireBlockOwnership(parsed.data.blockId, user.id);
  if (!ownership) {
    return { ok: false, error: "Block not found", code: "not_found" };
  }
  if (ownership.block.type !== "text") {
    return { ok: false, error: "Only text blocks are translatable here", code: "wrong_block_type" };
  }
  const course = await getCourseById(ownership.courseId);
  if (!course) {
    return { ok: false, error: "Course not found", code: "not_found" };
  }
  if (course.defaultLocale === parsed.data.locale) {
    return {
      ok: false,
      error: "Edit the source block to change default-locale content.",
      code: "cannot_translate_to_default",
    };
  }

  const data: TextBlockData = { markdown: parsed.data.markdown };

  const [existing] = await db
    .select({ id: schema.contentBlockTranslations.id })
    .from(schema.contentBlockTranslations)
    .where(
      and(
        eq(schema.contentBlockTranslations.blockId, parsed.data.blockId),
        eq(schema.contentBlockTranslations.locale, parsed.data.locale),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(schema.contentBlockTranslations)
      .set({ data, updatedAt: new Date() })
      .where(eq(schema.contentBlockTranslations.id, existing.id));
  } else {
    await db
      .insert(schema.contentBlockTranslations)
      .values({ blockId: parsed.data.blockId, locale: parsed.data.locale, data });
  }

  revalidateCoursePaths(parsed.data.lang, ownership.courseId);
  return { ok: true, data: { blockId: parsed.data.blockId, locale: parsed.data.locale } };
}
