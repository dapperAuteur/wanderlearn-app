"use server";

import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import {
  nextBlockOrderIndex,
  requireBlockOwnership,
  requireLessonOwnership,
} from "@/db/queries/content-blocks";
import { requireCreator } from "@/lib/rbac";
import type { Locale } from "@/lib/locales";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

const langSchema = z.enum(["en", "es"]);

export type TextBlockData = { markdown: string };
export type Photo360BlockData = { mediaId: string; caption?: string };
export type VideoBlockData = { mediaId: string; caption?: string };
export type Video360BlockData = { mediaId: string; caption?: string };

const createTextBlockSchema = z.object({
  lessonId: z.string().uuid(),
  markdown: z.string().min(1).max(20_000),
  lang: langSchema,
});

const updateTextBlockSchema = z.object({
  id: z.string().uuid(),
  markdown: z.string().min(1).max(20_000),
  lang: langSchema,
});

const createPhoto360BlockSchema = z.object({
  lessonId: z.string().uuid(),
  mediaId: z.string().uuid(),
  caption: z.string().max(500).optional(),
  lang: langSchema,
});

const updatePhoto360BlockSchema = z.object({
  id: z.string().uuid(),
  mediaId: z.string().uuid(),
  caption: z.string().max(500).optional(),
  lang: langSchema,
});

const createVideo360BlockSchema = z.object({
  lessonId: z.string().uuid(),
  mediaId: z.string().uuid(),
  caption: z.string().max(500).optional(),
  lang: langSchema,
});

const updateVideo360BlockSchema = z.object({
  id: z.string().uuid(),
  mediaId: z.string().uuid(),
  caption: z.string().max(500).optional(),
  lang: langSchema,
});

const createVideoBlockSchema = z.object({
  lessonId: z.string().uuid(),
  mediaId: z.string().uuid(),
  caption: z.string().max(500).optional(),
  lang: langSchema,
});

const updateVideoBlockSchema = z.object({
  id: z.string().uuid(),
  mediaId: z.string().uuid(),
  caption: z.string().max(500).optional(),
  lang: langSchema,
});

const deleteSchema = z.object({
  id: z.string().uuid(),
  lang: langSchema,
});

function revalidateLessonPaths(lang: string, courseId: string, lessonId: string) {
  revalidatePath(`/${lang}/creator/courses/${courseId}/lessons/${lessonId}`);
  revalidatePath(`/${lang}/creator/courses/${courseId}/lessons/${lessonId}/edit`);
}

export async function createTextBlock(
  formData: FormData,
): Promise<Result<{ id: string; lessonId: string; courseId: string }>> {
  const parsed = createTextBlockSchema.safeParse({
    lessonId: String(formData.get("lessonId") ?? ""),
    markdown: String(formData.get("markdown") ?? ""),
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  const lesson = await requireLessonOwnership(parsed.data.lessonId, user.id);
  if (!lesson) {
    return { ok: false, error: "Lesson not found", code: "lesson_not_found" };
  }

  const orderIndex = await nextBlockOrderIndex(parsed.data.lessonId);

  const [row] = await db
    .insert(schema.contentBlocks)
    .values({
      lessonId: parsed.data.lessonId,
      orderIndex,
      type: "text",
      data: { markdown: parsed.data.markdown } satisfies TextBlockData,
    })
    .returning({ id: schema.contentBlocks.id });

  if (!row) {
    return { ok: false, error: "Failed to create block", code: "db_insert_failed" };
  }

  revalidateLessonPaths(parsed.data.lang, lesson.courseId, parsed.data.lessonId);
  return {
    ok: true,
    data: { id: row.id, lessonId: parsed.data.lessonId, courseId: lesson.courseId },
  };
}

export async function updateTextBlock(
  formData: FormData,
): Promise<Result<{ id: string; lessonId: string; courseId: string }>> {
  const parsed = updateTextBlockSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    markdown: String(formData.get("markdown") ?? ""),
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  const ownership = await requireBlockOwnership(parsed.data.id, user.id);
  if (!ownership) {
    return { ok: false, error: "Block not found", code: "not_found" };
  }
  if (ownership.block.type !== "text") {
    return { ok: false, error: "Block is not a text block", code: "wrong_block_type" };
  }

  await db
    .update(schema.contentBlocks)
    .set({
      data: { markdown: parsed.data.markdown } satisfies TextBlockData,
      updatedAt: new Date(),
    })
    .where(eq(schema.contentBlocks.id, parsed.data.id));

  revalidateLessonPaths(parsed.data.lang, ownership.courseId, ownership.lessonId);
  return {
    ok: true,
    data: { id: parsed.data.id, lessonId: ownership.lessonId, courseId: ownership.courseId },
  };
}

async function requireOwnedPhoto360(
  mediaId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; code: string }> {
  const [row] = await db
    .select({
      kind: schema.mediaAssets.kind,
      status: schema.mediaAssets.status,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.id, mediaId),
        eq(schema.mediaAssets.ownerId, userId),
        isNull(schema.mediaAssets.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return { ok: false, code: "media_not_found" };
  if (row.kind !== "photo_360") return { ok: false, code: "invalid_media_kind" };
  if (row.status !== "ready") return { ok: false, code: "media_not_ready" };
  return { ok: true };
}

export async function createPhoto360Block(
  formData: FormData,
): Promise<Result<{ id: string; lessonId: string; courseId: string }>> {
  const parsed = createPhoto360BlockSchema.safeParse({
    lessonId: String(formData.get("lessonId") ?? ""),
    mediaId: String(formData.get("mediaId") ?? ""),
    caption: String(formData.get("caption") ?? "").trim() || undefined,
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  const lesson = await requireLessonOwnership(parsed.data.lessonId, user.id);
  if (!lesson) {
    return { ok: false, error: "Lesson not found", code: "lesson_not_found" };
  }

  const mediaCheck = await requireOwnedPhoto360(parsed.data.mediaId, user.id);
  if (!mediaCheck.ok) {
    return { ok: false, error: "Media is not a ready 360° photo you own", code: mediaCheck.code };
  }

  const orderIndex = await nextBlockOrderIndex(parsed.data.lessonId);

  const data: Photo360BlockData = { mediaId: parsed.data.mediaId };
  if (parsed.data.caption) data.caption = parsed.data.caption;

  const [row] = await db
    .insert(schema.contentBlocks)
    .values({
      lessonId: parsed.data.lessonId,
      orderIndex,
      type: "photo_360",
      data,
    })
    .returning({ id: schema.contentBlocks.id });

  if (!row) {
    return { ok: false, error: "Failed to create block", code: "db_insert_failed" };
  }

  revalidateLessonPaths(parsed.data.lang, lesson.courseId, parsed.data.lessonId);
  return {
    ok: true,
    data: { id: row.id, lessonId: parsed.data.lessonId, courseId: lesson.courseId },
  };
}

export async function updatePhoto360Block(
  formData: FormData,
): Promise<Result<{ id: string; lessonId: string; courseId: string }>> {
  const parsed = updatePhoto360BlockSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    mediaId: String(formData.get("mediaId") ?? ""),
    caption: String(formData.get("caption") ?? "").trim() || undefined,
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  const ownership = await requireBlockOwnership(parsed.data.id, user.id);
  if (!ownership) {
    return { ok: false, error: "Block not found", code: "not_found" };
  }
  if (ownership.block.type !== "photo_360") {
    return { ok: false, error: "Block is not a 360° photo block", code: "wrong_block_type" };
  }

  const mediaCheck = await requireOwnedPhoto360(parsed.data.mediaId, user.id);
  if (!mediaCheck.ok) {
    return { ok: false, error: "Media is not a ready 360° photo you own", code: mediaCheck.code };
  }

  const data: Photo360BlockData = { mediaId: parsed.data.mediaId };
  if (parsed.data.caption) data.caption = parsed.data.caption;

  await db
    .update(schema.contentBlocks)
    .set({ data, updatedAt: new Date() })
    .where(eq(schema.contentBlocks.id, parsed.data.id));

  revalidateLessonPaths(parsed.data.lang, ownership.courseId, ownership.lessonId);
  return {
    ok: true,
    data: { id: parsed.data.id, lessonId: ownership.lessonId, courseId: ownership.courseId },
  };
}

async function requireOwnedVideo360(
  mediaId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; code: string }> {
  const [row] = await db
    .select({
      kind: schema.mediaAssets.kind,
      status: schema.mediaAssets.status,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.id, mediaId),
        eq(schema.mediaAssets.ownerId, userId),
        isNull(schema.mediaAssets.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return { ok: false, code: "media_not_found" };
  if (row.kind !== "video_360") return { ok: false, code: "invalid_media_kind" };
  if (row.status !== "ready") return { ok: false, code: "media_not_ready" };
  return { ok: true };
}

export async function createVideo360Block(
  formData: FormData,
): Promise<Result<{ id: string; lessonId: string; courseId: string }>> {
  const parsed = createVideo360BlockSchema.safeParse({
    lessonId: String(formData.get("lessonId") ?? ""),
    mediaId: String(formData.get("mediaId") ?? ""),
    caption: String(formData.get("caption") ?? "").trim() || undefined,
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  const lesson = await requireLessonOwnership(parsed.data.lessonId, user.id);
  if (!lesson) {
    return { ok: false, error: "Lesson not found", code: "lesson_not_found" };
  }

  const mediaCheck = await requireOwnedVideo360(parsed.data.mediaId, user.id);
  if (!mediaCheck.ok) {
    return {
      ok: false,
      error: "Media is not a ready 360° video you own",
      code: mediaCheck.code,
    };
  }

  const orderIndex = await nextBlockOrderIndex(parsed.data.lessonId);

  const data: Video360BlockData = { mediaId: parsed.data.mediaId };
  if (parsed.data.caption) data.caption = parsed.data.caption;

  const [row] = await db
    .insert(schema.contentBlocks)
    .values({
      lessonId: parsed.data.lessonId,
      orderIndex,
      type: "video_360",
      data,
    })
    .returning({ id: schema.contentBlocks.id });

  if (!row) {
    return { ok: false, error: "Failed to create block", code: "db_insert_failed" };
  }

  revalidateLessonPaths(parsed.data.lang, lesson.courseId, parsed.data.lessonId);
  return {
    ok: true,
    data: { id: row.id, lessonId: parsed.data.lessonId, courseId: lesson.courseId },
  };
}

export async function updateVideo360Block(
  formData: FormData,
): Promise<Result<{ id: string; lessonId: string; courseId: string }>> {
  const parsed = updateVideo360BlockSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    mediaId: String(formData.get("mediaId") ?? ""),
    caption: String(formData.get("caption") ?? "").trim() || undefined,
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  const ownership = await requireBlockOwnership(parsed.data.id, user.id);
  if (!ownership) {
    return { ok: false, error: "Block not found", code: "not_found" };
  }
  if (ownership.block.type !== "video_360") {
    return { ok: false, error: "Block is not a 360° video block", code: "wrong_block_type" };
  }

  const mediaCheck = await requireOwnedVideo360(parsed.data.mediaId, user.id);
  if (!mediaCheck.ok) {
    return {
      ok: false,
      error: "Media is not a ready 360° video you own",
      code: mediaCheck.code,
    };
  }

  const data: Video360BlockData = { mediaId: parsed.data.mediaId };
  if (parsed.data.caption) data.caption = parsed.data.caption;

  await db
    .update(schema.contentBlocks)
    .set({ data, updatedAt: new Date() })
    .where(eq(schema.contentBlocks.id, parsed.data.id));

  revalidateLessonPaths(parsed.data.lang, ownership.courseId, ownership.lessonId);
  return {
    ok: true,
    data: { id: parsed.data.id, lessonId: ownership.lessonId, courseId: ownership.courseId },
  };
}

async function requireOwnedStandardVideo(
  mediaId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; code: string }> {
  const [row] = await db
    .select({
      kind: schema.mediaAssets.kind,
      status: schema.mediaAssets.status,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.id, mediaId),
        eq(schema.mediaAssets.ownerId, userId),
        isNull(schema.mediaAssets.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return { ok: false, code: "media_not_found" };
  if (row.kind !== "standard_video") return { ok: false, code: "invalid_media_kind" };
  if (row.status !== "ready") return { ok: false, code: "media_not_ready" };
  return { ok: true };
}

export async function createVideoBlock(
  formData: FormData,
): Promise<Result<{ id: string; lessonId: string; courseId: string }>> {
  const parsed = createVideoBlockSchema.safeParse({
    lessonId: String(formData.get("lessonId") ?? ""),
    mediaId: String(formData.get("mediaId") ?? ""),
    caption: String(formData.get("caption") ?? "").trim() || undefined,
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  const lesson = await requireLessonOwnership(parsed.data.lessonId, user.id);
  if (!lesson) {
    return { ok: false, error: "Lesson not found", code: "lesson_not_found" };
  }

  const mediaCheck = await requireOwnedStandardVideo(parsed.data.mediaId, user.id);
  if (!mediaCheck.ok) {
    return { ok: false, error: "Media is not a ready video you own", code: mediaCheck.code };
  }

  const orderIndex = await nextBlockOrderIndex(parsed.data.lessonId);

  const data: VideoBlockData = { mediaId: parsed.data.mediaId };
  if (parsed.data.caption) data.caption = parsed.data.caption;

  const [row] = await db
    .insert(schema.contentBlocks)
    .values({
      lessonId: parsed.data.lessonId,
      orderIndex,
      type: "video",
      data,
    })
    .returning({ id: schema.contentBlocks.id });

  if (!row) {
    return { ok: false, error: "Failed to create block", code: "db_insert_failed" };
  }

  revalidateLessonPaths(parsed.data.lang, lesson.courseId, parsed.data.lessonId);
  return {
    ok: true,
    data: { id: row.id, lessonId: parsed.data.lessonId, courseId: lesson.courseId },
  };
}

export async function updateVideoBlock(
  formData: FormData,
): Promise<Result<{ id: string; lessonId: string; courseId: string }>> {
  const parsed = updateVideoBlockSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    mediaId: String(formData.get("mediaId") ?? ""),
    caption: String(formData.get("caption") ?? "").trim() || undefined,
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  const ownership = await requireBlockOwnership(parsed.data.id, user.id);
  if (!ownership) {
    return { ok: false, error: "Block not found", code: "not_found" };
  }
  if (ownership.block.type !== "video") {
    return { ok: false, error: "Block is not a video block", code: "wrong_block_type" };
  }

  const mediaCheck = await requireOwnedStandardVideo(parsed.data.mediaId, user.id);
  if (!mediaCheck.ok) {
    return { ok: false, error: "Media is not a ready video you own", code: mediaCheck.code };
  }

  const data: VideoBlockData = { mediaId: parsed.data.mediaId };
  if (parsed.data.caption) data.caption = parsed.data.caption;

  await db
    .update(schema.contentBlocks)
    .set({ data, updatedAt: new Date() })
    .where(eq(schema.contentBlocks.id, parsed.data.id));

  revalidateLessonPaths(parsed.data.lang, ownership.courseId, ownership.lessonId);
  return {
    ok: true,
    data: { id: parsed.data.id, lessonId: ownership.lessonId, courseId: ownership.courseId },
  };
}

export async function deleteBlock(
  formData: FormData,
): Promise<Result<{ lessonId: string; courseId: string }>> {
  const parsed = deleteSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  const ownership = await requireBlockOwnership(parsed.data.id, user.id);
  if (!ownership) {
    return { ok: false, error: "Block not found", code: "not_found" };
  }

  await db.transaction(async (tx) => {
    await tx.delete(schema.contentBlocks).where(eq(schema.contentBlocks.id, parsed.data.id));
    await tx
      .update(schema.contentBlocks)
      .set({ orderIndex: sql`${schema.contentBlocks.orderIndex} - 1` })
      .where(
        and(
          eq(schema.contentBlocks.lessonId, ownership.lessonId),
          gt(schema.contentBlocks.orderIndex, ownership.block.orderIndex),
        ),
      );
  });

  revalidateLessonPaths(parsed.data.lang, ownership.courseId, ownership.lessonId);
  return {
    ok: true,
    data: { lessonId: ownership.lessonId, courseId: ownership.courseId },
  };
}
