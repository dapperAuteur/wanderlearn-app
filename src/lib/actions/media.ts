"use server";

import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { requireCreator } from "@/lib/rbac";
import { destroyAsset, type UploadKind } from "@/lib/cloudinary";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

export type MediaBlocker = {
  type: "destination" | "scene" | "course";
  id: string;
  name: string;
};

const langSchema = z.enum(["en", "es"]);

const tagSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u, "invalid_tag");

const updateSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  tags: z.array(tagSchema).max(25).optional(),
  lang: langSchema,
});

function parseTags(value: FormDataEntryValue | null): string[] {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of raw.split(",")) {
    const trimmed = piece.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

const deleteSchema = z.object({
  id: z.string().uuid(),
  hardDelete: z.boolean(),
  lang: langSchema,
});

const linkTranscriptSchema = z.object({
  videoId: z.string().uuid(),
  transcriptId: z.string().uuid().nullable(),
  lang: langSchema,
});

const VIDEO_KINDS = new Set(["standard_video", "video_360", "drone_video", "screen_recording"]);

function parseBool(value: FormDataEntryValue | null): boolean {
  return value === "1" || value === "true" || value === "on";
}

function trimOrUndefined(value: FormDataEntryValue | null): string | undefined {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function findReferences(mediaId: string): Promise<MediaBlocker[]> {
  const [destRefs, sceneRefs, courseRefs] = await Promise.all([
    db
      .select({ id: schema.destinations.id, name: schema.destinations.name })
      .from(schema.destinations)
      .where(eq(schema.destinations.heroMediaId, mediaId)),
    db
      .select({ id: schema.scenes.id, name: schema.scenes.name })
      .from(schema.scenes)
      .where(
        or(
          eq(schema.scenes.panoramaMediaId, mediaId),
          eq(schema.scenes.posterMediaId, mediaId),
        ),
      ),
    db
      .select({ id: schema.courses.id, name: schema.courses.title })
      .from(schema.courses)
      .where(eq(schema.courses.coverMediaId, mediaId)),
  ]);

  return [
    ...destRefs.map((r) => ({ type: "destination" as const, id: r.id, name: r.name })),
    ...sceneRefs.map((r) => ({ type: "scene" as const, id: r.id, name: r.name })),
    ...courseRefs.map((r) => ({ type: "course" as const, id: r.id, name: r.name })),
  ];
}

export async function updateMedia(formData: FormData): Promise<Result<{ id: string }>> {
  const rawTags = parseTags(formData.get("tags"));
  const parsed = updateSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    displayName: trimOrUndefined(formData.get("displayName")),
    description: trimOrUndefined(formData.get("description")),
    tags: rawTags.length > 0 ? rawTags : undefined,
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  const [existing] = await db
    .select({ id: schema.mediaAssets.id })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.id, parsed.data.id),
        eq(schema.mediaAssets.ownerId, user.id),
        isNull(schema.mediaAssets.deletedAt),
      ),
    )
    .limit(1);

  if (!existing) {
    return { ok: false, error: "Media not found", code: "not_found" };
  }

  const updateValues: Record<string, unknown> = {
    displayName: parsed.data.displayName ?? null,
    description: parsed.data.description ?? null,
    updatedAt: new Date(),
  };
  if (parsed.data.tags !== undefined) {
    updateValues.tags = parsed.data.tags;
  }

  await db
    .update(schema.mediaAssets)
    .set(updateValues)
    .where(eq(schema.mediaAssets.id, parsed.data.id));

  revalidatePath(`/${parsed.data.lang}/creator/media`);
  return { ok: true, data: { id: parsed.data.id } };
}

const bulkAddTagsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(60),
  addTags: z.array(tagSchema).min(1).max(10),
  lang: langSchema,
});

export async function bulkAddTags(
  input: z.infer<typeof bulkAddTagsSchema>,
): Promise<Result<{ updated: number }>> {
  const parsed = bulkAddTagsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  const owned = await db
    .select({ id: schema.mediaAssets.id, tags: schema.mediaAssets.tags })
    .from(schema.mediaAssets)
    .where(
      and(
        inArray(schema.mediaAssets.id, parsed.data.ids),
        eq(schema.mediaAssets.ownerId, user.id),
        isNull(schema.mediaAssets.deletedAt),
      ),
    );

  if (owned.length === 0) {
    return { ok: false, error: "No matching media", code: "not_found" };
  }

  const seenAdd = new Set<string>();
  const additions: string[] = [];
  for (const t of parsed.data.addTags) {
    const key = t.toLowerCase();
    if (seenAdd.has(key)) continue;
    seenAdd.add(key);
    additions.push(t);
  }

  let updated = 0;
  for (const row of owned) {
    const existingKeys = new Set(row.tags.map((t) => t.toLowerCase()));
    const merged = [...row.tags];
    let changed = false;
    for (const t of additions) {
      if (existingKeys.has(t.toLowerCase())) continue;
      merged.push(t);
      changed = true;
    }
    if (!changed) continue;
    if (merged.length > 25) {
      return { ok: false, error: "Tag limit exceeded on a row", code: "tag_limit" };
    }
    await db
      .update(schema.mediaAssets)
      .set({ tags: merged, updatedAt: new Date() })
      .where(eq(schema.mediaAssets.id, row.id));
    updated += 1;
  }

  revalidatePath(`/${parsed.data.lang}/creator/media`);
  return { ok: true, data: { updated } };
}

export async function linkTranscript(formData: FormData): Promise<Result<{ id: string }>> {
  const rawTranscript = String(formData.get("transcriptId") ?? "");
  const parsed = linkTranscriptSchema.safeParse({
    videoId: String(formData.get("videoId") ?? ""),
    transcriptId: rawTranscript.length > 0 ? rawTranscript : null,
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  const [video] = await db
    .select({
      id: schema.mediaAssets.id,
      kind: schema.mediaAssets.kind,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.id, parsed.data.videoId),
        eq(schema.mediaAssets.ownerId, user.id),
        isNull(schema.mediaAssets.deletedAt),
      ),
    )
    .limit(1);
  if (!video) {
    return { ok: false, error: "Video not found", code: "not_found" };
  }
  if (!VIDEO_KINDS.has(video.kind)) {
    return { ok: false, error: "Transcripts can only attach to videos", code: "invalid_target_kind" };
  }

  if (parsed.data.transcriptId) {
    const [transcript] = await db
      .select({ id: schema.mediaAssets.id, kind: schema.mediaAssets.kind })
      .from(schema.mediaAssets)
      .where(
        and(
          eq(schema.mediaAssets.id, parsed.data.transcriptId),
          eq(schema.mediaAssets.ownerId, user.id),
          isNull(schema.mediaAssets.deletedAt),
        ),
      )
      .limit(1);
    if (!transcript) {
      return { ok: false, error: "Transcript not found", code: "transcript_not_found" };
    }
    if (transcript.kind !== "transcript") {
      return { ok: false, error: "Linked file must be a transcript", code: "invalid_transcript_kind" };
    }
  }

  await db
    .update(schema.mediaAssets)
    .set({ transcriptMediaId: parsed.data.transcriptId, updatedAt: new Date() })
    .where(eq(schema.mediaAssets.id, parsed.data.videoId));

  revalidatePath(`/${parsed.data.lang}/creator/media`);
  return { ok: true, data: { id: parsed.data.videoId } };
}

export async function deleteMedia(
  formData: FormData,
): Promise<Result<{ id: string; hardDeleted: boolean }> & { blockers?: MediaBlocker[] }> {
  const parsed = deleteSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    hardDelete: parseBool(formData.get("hardDelete")),
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  const [row] = await db
    .select({
      id: schema.mediaAssets.id,
      kind: schema.mediaAssets.kind,
      cloudinaryPublicId: schema.mediaAssets.cloudinaryPublicId,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.id, parsed.data.id),
        eq(schema.mediaAssets.ownerId, user.id),
      ),
    )
    .limit(1);

  if (!row) {
    return { ok: false, error: "Media not found", code: "not_found" };
  }

  const blockers = await findReferences(parsed.data.id);
  if (blockers.length > 0) {
    return {
      ok: false,
      error: "Media is still in use",
      code: "in_use",
      blockers,
    };
  }

  if (parsed.data.hardDelete) {
    if (row.cloudinaryPublicId) {
      const destroyed = await destroyAsset(row.cloudinaryPublicId, row.kind as UploadKind);
      if (!destroyed.ok) {
        return {
          ok: false,
          error: `Cloudinary delete failed: ${destroyed.error}`,
          code: "cloudinary_delete_failed",
        };
      }
    }
    await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, parsed.data.id));
    revalidatePath(`/${parsed.data.lang}/creator/media`);
    return { ok: true, data: { id: parsed.data.id, hardDeleted: true } };
  }

  await db
    .update(schema.mediaAssets)
    .set({
      status: "deleted",
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.mediaAssets.id, parsed.data.id));

  revalidatePath(`/${parsed.data.lang}/creator/media`);
  return { ok: true, data: { id: parsed.data.id, hardDeleted: false } };
}
