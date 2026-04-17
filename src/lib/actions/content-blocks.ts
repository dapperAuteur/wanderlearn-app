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
export type VirtualTourBlockData = {
  destinationId: string;
  startSceneId?: string;
  caption?: string;
};

export type QuizOption = { id: string; text: string };
export type QuizQuestion = {
  id: string;
  text: string;
  options: QuizOption[];
  correctOptionId: string;
  explanation?: string;
};
export type QuizBlockData = {
  title?: string;
  passThresholdPercent: number;
  questions: QuizQuestion[];
};

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

const quizOptionSchema = z.object({
  id: z.string().min(1).max(40),
  text: z.string().min(1).max(300),
});

const quizQuestionSchema = z
  .object({
    id: z.string().min(1).max(40),
    text: z.string().min(1).max(1000),
    options: z.array(quizOptionSchema).min(2).max(8),
    correctOptionId: z.string().min(1).max(40),
    explanation: z.string().max(1000).optional(),
  })
  .refine((q) => q.options.some((o) => o.id === q.correctOptionId), {
    message: "correctOptionId must match one of the options",
    path: ["correctOptionId"],
  });

const createQuizBlockSchema = z.object({
  lessonId: z.string().uuid(),
  payload: z.string().min(1).max(100_000),
  lang: langSchema,
});

const updateQuizBlockSchema = z.object({
  id: z.string().uuid(),
  payload: z.string().min(1).max(100_000),
  lang: langSchema,
});

const quizPayloadSchema = z.object({
  title: z.string().max(200).optional(),
  passThresholdPercent: z.coerce.number().int().min(0).max(100).default(70),
  questions: z.array(quizQuestionSchema).min(1).max(20),
});

const createVirtualTourBlockSchema = z.object({
  lessonId: z.string().uuid(),
  destinationId: z.string().uuid(),
  startSceneId: z
    .union([z.string().uuid(), z.string().length(0)])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  caption: z.string().max(500).optional(),
  lang: langSchema,
});

const updateVirtualTourBlockSchema = z.object({
  id: z.string().uuid(),
  destinationId: z.string().uuid(),
  startSceneId: z
    .union([z.string().uuid(), z.string().length(0)])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  caption: z.string().max(500).optional(),
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

async function requireOwnedDestinationHasAnyScene(
  destinationId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; code: string }> {
  const [scene] = await db
    .select({ id: schema.scenes.id })
    .from(schema.scenes)
    .where(
      and(
        eq(schema.scenes.destinationId, destinationId),
        eq(schema.scenes.ownerId, userId),
      ),
    )
    .limit(1);
  if (!scene) return { ok: false, code: "no_scenes_owned" };
  return { ok: true };
}

async function requireSceneAtDestination(
  sceneId: string,
  destinationId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; code: string }> {
  const [scene] = await db
    .select({ id: schema.scenes.id })
    .from(schema.scenes)
    .where(
      and(
        eq(schema.scenes.id, sceneId),
        eq(schema.scenes.destinationId, destinationId),
        eq(schema.scenes.ownerId, userId),
      ),
    )
    .limit(1);
  if (!scene) return { ok: false, code: "start_scene_not_owned" };
  return { ok: true };
}

export async function createVirtualTourBlock(
  formData: FormData,
): Promise<Result<{ id: string; lessonId: string; courseId: string }>> {
  const parsed = createVirtualTourBlockSchema.safeParse({
    lessonId: String(formData.get("lessonId") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    startSceneId: String(formData.get("startSceneId") ?? ""),
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

  const destCheck = await requireOwnedDestinationHasAnyScene(
    parsed.data.destinationId,
    user.id,
  );
  if (!destCheck.ok) {
    return {
      ok: false,
      error: "You don't own any scenes at that destination yet",
      code: destCheck.code,
    };
  }

  if (parsed.data.startSceneId) {
    const startCheck = await requireSceneAtDestination(
      parsed.data.startSceneId,
      parsed.data.destinationId,
      user.id,
    );
    if (!startCheck.ok) {
      return {
        ok: false,
        error: "Start scene must belong to the same destination and be owned by you",
        code: startCheck.code,
      };
    }
  }

  const orderIndex = await nextBlockOrderIndex(parsed.data.lessonId);

  const data: VirtualTourBlockData = { destinationId: parsed.data.destinationId };
  if (parsed.data.startSceneId) data.startSceneId = parsed.data.startSceneId;
  if (parsed.data.caption) data.caption = parsed.data.caption;

  const [row] = await db
    .insert(schema.contentBlocks)
    .values({
      lessonId: parsed.data.lessonId,
      orderIndex,
      type: "virtual_tour",
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

export async function updateVirtualTourBlock(
  formData: FormData,
): Promise<Result<{ id: string; lessonId: string; courseId: string }>> {
  const parsed = updateVirtualTourBlockSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    startSceneId: String(formData.get("startSceneId") ?? ""),
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
  if (ownership.block.type !== "virtual_tour") {
    return { ok: false, error: "Block is not a virtual tour block", code: "wrong_block_type" };
  }

  const destCheck = await requireOwnedDestinationHasAnyScene(
    parsed.data.destinationId,
    user.id,
  );
  if (!destCheck.ok) {
    return {
      ok: false,
      error: "You don't own any scenes at that destination yet",
      code: destCheck.code,
    };
  }

  if (parsed.data.startSceneId) {
    const startCheck = await requireSceneAtDestination(
      parsed.data.startSceneId,
      parsed.data.destinationId,
      user.id,
    );
    if (!startCheck.ok) {
      return {
        ok: false,
        error: "Start scene must belong to the same destination and be owned by you",
        code: startCheck.code,
      };
    }
  }

  const data: VirtualTourBlockData = { destinationId: parsed.data.destinationId };
  if (parsed.data.startSceneId) data.startSceneId = parsed.data.startSceneId;
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

function parseQuizPayload(
  raw: string,
): { ok: true; data: QuizBlockData } | { ok: false; code: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, code: "invalid_json" };
  }
  const parsed = quizPayloadSchema.safeParse(json);
  if (!parsed.success) return { ok: false, code: "invalid_quiz_shape" };
  // Ensure question + option ids are unique within the block.
  const questionIds = new Set<string>();
  for (const q of parsed.data.questions) {
    if (questionIds.has(q.id)) return { ok: false, code: "duplicate_question_id" };
    questionIds.add(q.id);
    const optionIds = new Set<string>();
    for (const o of q.options) {
      if (optionIds.has(o.id)) return { ok: false, code: "duplicate_option_id" };
      optionIds.add(o.id);
    }
  }
  return { ok: true, data: parsed.data };
}

export async function createQuizBlock(
  formData: FormData,
): Promise<Result<{ id: string; lessonId: string; courseId: string }>> {
  const parsed = createQuizBlockSchema.safeParse({
    lessonId: String(formData.get("lessonId") ?? ""),
    payload: String(formData.get("payload") ?? ""),
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

  const body = parseQuizPayload(parsed.data.payload);
  if (!body.ok) {
    return { ok: false, error: "Invalid quiz shape", code: body.code };
  }

  const orderIndex = await nextBlockOrderIndex(parsed.data.lessonId);

  const [row] = await db
    .insert(schema.contentBlocks)
    .values({
      lessonId: parsed.data.lessonId,
      orderIndex,
      type: "quiz",
      data: body.data,
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

export async function updateQuizBlock(
  formData: FormData,
): Promise<Result<{ id: string; lessonId: string; courseId: string }>> {
  const parsed = updateQuizBlockSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    payload: String(formData.get("payload") ?? ""),
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
  if (ownership.block.type !== "quiz") {
    return { ok: false, error: "Block is not a quiz block", code: "wrong_block_type" };
  }

  const body = parseQuizPayload(parsed.data.payload);
  if (!body.ok) {
    return { ok: false, error: "Invalid quiz shape", code: body.code };
  }

  await db
    .update(schema.contentBlocks)
    .set({ data: body.data, updatedAt: new Date() })
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
