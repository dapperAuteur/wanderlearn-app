import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type {
  Photo360BlockData,
  Video360BlockData,
  VideoBlockData,
} from "@/lib/actions/content-blocks";

export type PublishViolation =
  | {
      kind: "no_lessons";
    }
  | {
      kind: "lesson_empty";
      lessonId: string;
      lessonTitle: string;
    }
  | {
      kind: "video_missing_transcript";
      lessonId: string;
      lessonTitle: string;
      blockId: string;
    }
  | {
      kind: "media_not_ready";
      lessonId: string;
      lessonTitle: string;
      blockId: string;
      blockType: "video" | "video_360" | "photo_360";
    }
  | {
      kind: "media_missing";
      lessonId: string;
      lessonTitle: string;
      blockId: string;
      blockType: "video" | "video_360" | "photo_360";
    };

export async function checkCoursePublishReadiness(
  courseId: string,
): Promise<PublishViolation[]> {
  const violations: PublishViolation[] = [];

  const lessons = await db
    .select({
      id: schema.lessons.id,
      title: schema.lessons.title,
    })
    .from(schema.lessons)
    .where(eq(schema.lessons.courseId, courseId));

  if (lessons.length === 0) {
    violations.push({ kind: "no_lessons" });
    return violations;
  }

  const lessonIds = lessons.map((l) => l.id);
  const blocks = await db
    .select({
      id: schema.contentBlocks.id,
      lessonId: schema.contentBlocks.lessonId,
      type: schema.contentBlocks.type,
      data: schema.contentBlocks.data,
    })
    .from(schema.contentBlocks)
    .where(inArray(schema.contentBlocks.lessonId, lessonIds));

  const lessonMap = new Map(lessons.map((l) => [l.id, l]));
  const blocksByLesson = new Map<string, typeof blocks>();
  for (const b of blocks) {
    const arr = blocksByLesson.get(b.lessonId) ?? [];
    arr.push(b);
    blocksByLesson.set(b.lessonId, arr);
  }

  for (const l of lessons) {
    if ((blocksByLesson.get(l.id) ?? []).length === 0) {
      violations.push({ kind: "lesson_empty", lessonId: l.id, lessonTitle: l.title });
    }
  }

  const mediaIds = Array.from(
    new Set(
      blocks
        .map((b) => {
          if (b.type === "video") return (b.data as VideoBlockData).mediaId;
          if (b.type === "photo_360") return (b.data as Photo360BlockData).mediaId;
          if (b.type === "video_360") return (b.data as Video360BlockData).mediaId;
          return null;
        })
        .filter((id): id is string => id !== null),
    ),
  );

  const mediaMap = new Map<
    string,
    { status: string; transcriptMediaId: string | null }
  >();
  if (mediaIds.length > 0) {
    const rows = await db
      .select({
        id: schema.mediaAssets.id,
        status: schema.mediaAssets.status,
        transcriptMediaId: schema.mediaAssets.transcriptMediaId,
      })
      .from(schema.mediaAssets)
      .where(inArray(schema.mediaAssets.id, mediaIds));
    for (const r of rows) {
      mediaMap.set(r.id, {
        status: r.status,
        transcriptMediaId: r.transcriptMediaId,
      });
    }
  }

  for (const b of blocks) {
    const lesson = lessonMap.get(b.lessonId);
    if (!lesson) continue;

    let mediaBlockType: "video" | "video_360" | "photo_360";
    let mediaId: string;
    if (b.type === "video") {
      mediaBlockType = "video";
      mediaId = (b.data as VideoBlockData).mediaId;
    } else if (b.type === "video_360") {
      mediaBlockType = "video_360";
      mediaId = (b.data as Video360BlockData).mediaId;
    } else if (b.type === "photo_360") {
      mediaBlockType = "photo_360";
      mediaId = (b.data as Photo360BlockData).mediaId;
    } else {
      continue;
    }

    const media = mediaMap.get(mediaId);
    if (!media) {
      violations.push({
        kind: "media_missing",
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        blockId: b.id,
        blockType: mediaBlockType,
      });
      continue;
    }
    if (media.status !== "ready") {
      violations.push({
        kind: "media_not_ready",
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        blockId: b.id,
        blockType: mediaBlockType,
      });
      continue;
    }
    if (
      (mediaBlockType === "video" || mediaBlockType === "video_360") &&
      !media.transcriptMediaId
    ) {
      violations.push({
        kind: "video_missing_transcript",
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        blockId: b.id,
      });
    }
  }

  return violations;
}
