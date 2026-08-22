"use server";

import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { canManage, canManageOrOwn, requireCreatorWithAuthz } from "@/lib/rbac";
import { destroyAsset, type UploadKind } from "@/lib/cloudinary";
import { getKindFamily } from "@/lib/media-kind-families";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

export type MediaBlocker = {
  type: "destination" | "scene" | "course";
  id: string;
  name: string;
  /** Scenes only: which field on the scene points at this file. */
  usedAs?: "panorama" | "poster" | "sound";
  /** Scenes only: the destination it belongs to, so the UI can link to it. */
  destinationId?: string;
  /**
   * Scenes only: connections that would break if the scene were removed.
   * Present so the UI can say WHICH ones to clear, by name, instead of telling
   * someone to go and look.
   */
  connections?: { otherSceneName: string; direction: "out" | "in" }[];
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
      .select({
        id: schema.scenes.id,
        name: schema.scenes.name,
        destinationId: schema.scenes.destinationId,
        panoramaMediaId: schema.scenes.panoramaMediaId,
        posterMediaId: schema.scenes.posterMediaId,
        audioMediaId: schema.scenes.audioMediaId,
      })
      .from(schema.scenes)
      .where(
        or(
          eq(schema.scenes.panoramaMediaId, mediaId),
          eq(schema.scenes.posterMediaId, mediaId),
          // Ambient audio was missing here. Because the column is ON DELETE SET
          // NULL, a hard delete succeeded and the scene silently lost its sound
          // instead of being reported as in use.
          eq(schema.scenes.audioMediaId, mediaId),
        ),
      ),
    db
      .select({ id: schema.courses.id, name: schema.courses.title })
      .from(schema.courses)
      .where(eq(schema.courses.coverMediaId, mediaId)),
  ]);

  // For each blocking scene, name the connections that would break with it, so
  // the message can be "remove these two connections" rather than "it is in use".
  const otherScenes = alias(schema.scenes, "other_scenes");
  const sceneConnections = await Promise.all(
    sceneRefs.map(async (scene) => {
      const [out, incoming] = await Promise.all([
        db
          .select({ otherSceneName: otherScenes.name })
          .from(schema.sceneLinks)
          .innerJoin(otherScenes, eq(otherScenes.id, schema.sceneLinks.toSceneId))
          .where(eq(schema.sceneLinks.fromSceneId, scene.id)),
        db
          .select({ otherSceneName: otherScenes.name })
          .from(schema.sceneLinks)
          .innerJoin(otherScenes, eq(otherScenes.id, schema.sceneLinks.fromSceneId))
          .where(eq(schema.sceneLinks.toSceneId, scene.id)),
      ]);
      return [
        ...out.map((r) => ({ otherSceneName: r.otherSceneName, direction: "out" as const })),
        ...incoming.map((r) => ({ otherSceneName: r.otherSceneName, direction: "in" as const })),
      ];
    }),
  );

  return [
    ...destRefs.map((r) => ({ type: "destination" as const, id: r.id, name: r.name })),
    ...sceneRefs.map((r, i) => ({
      type: "scene" as const,
      id: r.id,
      name: r.name,
      destinationId: r.destinationId ?? undefined,
      usedAs:
        r.panoramaMediaId === mediaId
          ? ("panorama" as const)
          : r.posterMediaId === mediaId
            ? ("poster" as const)
            : ("sound" as const),
      connections: sceneConnections[i],
    })),
    ...courseRefs.map((r) => ({ type: "course" as const, id: r.id, name: r.name })),
  ];
}

export async function updateMedia(formData: FormData): Promise<Result<{ id: string }>> {
  // Presence of the field, not emptiness of it, decides whether tags are written.
  // Previously `rawTags.length > 0 ? rawTags : undefined` conflated two different
  // things: "this form did not carry tags" and "the user cleared every tag". The
  // first must leave the column alone; the second must write an empty array. Because
  // both took the same branch there was no way to remove a file's last tag, and any
  // caller that omitted the field looked identical to a deliberate clear.
  const tagsField = formData.get("tags");
  const rawTags = parseTags(tagsField);
  const parsed = updateSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    displayName: trimOrUndefined(formData.get("displayName")),
    description: trimOrUndefined(formData.get("description")),
    tags: tagsField === null ? undefined : rawTags,
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const [existing] = await db
    .select({ id: schema.mediaAssets.id, ownerId: schema.mediaAssets.ownerId })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.id, parsed.data.id),
        isNull(schema.mediaAssets.deletedAt),
      ),
    )
    .limit(1);

  if (!existing) {
    return { ok: false, error: "Media not found", code: "not_found" };
  }
  if (!canManageOrOwn(user, existing.ownerId, "media", "update")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
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
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  // site_manager with media.update bypasses the owner filter; everyone
  // else can only bulk-tag their own rows.
  const bypass = canManage(user, "media", "update");
  const owned = await db
    .select({ id: schema.mediaAssets.id, tags: schema.mediaAssets.tags })
    .from(schema.mediaAssets)
    .where(
      bypass
        ? and(
            inArray(schema.mediaAssets.id, parsed.data.ids),
            isNull(schema.mediaAssets.deletedAt),
          )
        : and(
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

const changeKindSchema = z.object({
  id: z.string().uuid(),
  newKind: z.enum([
    "image",
    "photo_360",
    "standard_video",
    "video_360",
    "drone_video",
  ]),
  lang: langSchema,
});

const bulkRemoveTagsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(60),
  removeTags: z.array(z.string().trim().min(1).max(40)).min(1).max(20),
  lang: z.enum(["en", "es"]),
});

/**
 * Remove tags from many files at once — the counterpart to bulkAddTags.
 *
 * Case-insensitive, because the tag vocabulary is case-insensitive everywhere
 * else: someone removing "ghana" expects "Ghana" to go too, and leaving it
 * behind would look like the removal silently failed.
 */
export async function bulkRemoveTags(
  input: z.infer<typeof bulkRemoveTagsSchema>,
): Promise<Result<{ updated: number }>> {
  const parsed = bulkRemoveTagsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const bypass = canManage(user, "media", "update");
  const owned = await db
    .select({ id: schema.mediaAssets.id, tags: schema.mediaAssets.tags })
    .from(schema.mediaAssets)
    .where(
      bypass
        ? and(inArray(schema.mediaAssets.id, parsed.data.ids), isNull(schema.mediaAssets.deletedAt))
        : and(
            inArray(schema.mediaAssets.id, parsed.data.ids),
            eq(schema.mediaAssets.ownerId, user.id),
            isNull(schema.mediaAssets.deletedAt),
          ),
    );
  if (owned.length === 0) {
    return { ok: false, error: "No matching media", code: "not_found" };
  }

  const removeKeys = new Set(parsed.data.removeTags.map((t) => t.trim().toLowerCase()));

  let updated = 0;
  for (const row of owned) {
    const kept = row.tags.filter((t) => !removeKeys.has(t.trim().toLowerCase()));
    if (kept.length === row.tags.length) continue;
    await db
      .update(schema.mediaAssets)
      .set({ tags: kept, updatedAt: new Date() })
      .where(eq(schema.mediaAssets.id, row.id));
    updated += 1;
  }

  revalidatePath(`/${parsed.data.lang}/creator/media`);
  revalidatePath("/[lang]/creator/destinations/[id]", "page");
  return { ok: true, data: { updated } };
}

const bulkDeleteSchema = z.object({
  // Deliberately smaller than the tag cap. Each id costs a reference lookup,
  // and a destructive action should not be something you can fire at 60 files
  // in one click.
  ids: z.array(z.string().uuid()).min(1).max(25),
  lang: z.enum(["en", "es"]),
});

export type BulkDeleteOutcome = {
  deleted: string[];
  /** Still referenced by a scene, destination or course — skipped, not failed. */
  blocked: { id: string; blockers: MediaBlocker[] }[];
  /** Not owned by the caller, or already gone. */
  skipped: string[];
};

/**
 * Soft-delete many files at once.
 *
 * SOFT DELETE ONLY, deliberately. The single-file action can hard-delete,
 * which also destroys the Cloudinary asset — irreversible, and Cloudinary
 * public_ids are baked into every published URL. Offering that as a bulk
 * button is how someone loses twenty panoramas in one click. Hard delete stays
 * a per-file, one-at-a-time decision.
 *
 * IN-USE FILES ARE SKIPPED AND REPORTED, not failed. Deleting the batch and
 * reporting "3 failed" would leave the creator guessing which three; refusing
 * the whole batch because one file is in use would make the feature useless on
 * any real library. Each blocked file comes back with what is holding it.
 *
 * Ownership is re-checked per row rather than trusted from the selection: the
 * ids arrive from the client, so a crafted request must not reach someone
 * else's media.
 */
export async function bulkDeleteMedia(
  input: z.infer<typeof bulkDeleteSchema>,
): Promise<Result<BulkDeleteOutcome>> {
  const parsed = bulkDeleteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const bypass = canManage(user, "media", "delete");
  const rows = await db
    .select({ id: schema.mediaAssets.id, ownerId: schema.mediaAssets.ownerId })
    .from(schema.mediaAssets)
    .where(
      and(inArray(schema.mediaAssets.id, parsed.data.ids), isNull(schema.mediaAssets.deletedAt)),
    );

  const outcome: BulkDeleteOutcome = { deleted: [], blocked: [], skipped: [] };
  const found = new Set(rows.map((r) => r.id));
  for (const id of parsed.data.ids) if (!found.has(id)) outcome.skipped.push(id);

  for (const row of rows) {
    if (!bypass && !canManageOrOwn(user, row.ownerId, "media", "delete")) {
      outcome.skipped.push(row.id);
      continue;
    }
    const blockers = await findReferences(row.id);
    if (blockers.length > 0) {
      outcome.blocked.push({ id: row.id, blockers });
      continue;
    }
    await db
      .update(schema.mediaAssets)
      .set({ status: "deleted", deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.mediaAssets.id, row.id));
    outcome.deleted.push(row.id);
  }

  revalidatePath(`/${parsed.data.lang}/creator/media`);
  revalidatePath("/[lang]/creator/destinations/[id]", "page");
  return { ok: true, data: outcome };
}

export async function changeMediaKind(
  input: z.infer<typeof changeKindSchema>,
): Promise<Result<{ id: string; newKind: UploadKind }>> {
  const parsed = changeKindSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const [existing] = await db
    .select({
      id: schema.mediaAssets.id,
      kind: schema.mediaAssets.kind,
      ownerId: schema.mediaAssets.ownerId,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.id, parsed.data.id),
        isNull(schema.mediaAssets.deletedAt),
      ),
    )
    .limit(1);

  if (!existing) {
    return { ok: false, error: "Media not found", code: "not_found" };
  }
  if (!canManageOrOwn(user, existing.ownerId, "media", "update")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }

  const family = getKindFamily(existing.kind as UploadKind);
  if (!family || !family.includes(parsed.data.newKind)) {
    return {
      ok: false,
      error: "Kind cannot be changed for this file",
      code: "kind_change_not_allowed",
    };
  }

  if (existing.kind === parsed.data.newKind) {
    return { ok: true, data: { id: existing.id, newKind: parsed.data.newKind } };
  }

  await db
    .update(schema.mediaAssets)
    .set({ kind: parsed.data.newKind, updatedAt: new Date() })
    .where(eq(schema.mediaAssets.id, parsed.data.id));

  revalidatePath(`/${parsed.data.lang}/creator/media`);
  return { ok: true, data: { id: parsed.data.id, newKind: parsed.data.newKind } };
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
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const [video] = await db
    .select({
      id: schema.mediaAssets.id,
      kind: schema.mediaAssets.kind,
      ownerId: schema.mediaAssets.ownerId,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.id, parsed.data.videoId),
        isNull(schema.mediaAssets.deletedAt),
      ),
    )
    .limit(1);
  if (!video) {
    return { ok: false, error: "Video not found", code: "not_found" };
  }
  if (!canManageOrOwn(user, video.ownerId, "media", "update")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
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
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const [row] = await db
    .select({
      id: schema.mediaAssets.id,
      kind: schema.mediaAssets.kind,
      ownerId: schema.mediaAssets.ownerId,
      cloudinaryPublicId: schema.mediaAssets.cloudinaryPublicId,
    })
    .from(schema.mediaAssets)
    .where(eq(schema.mediaAssets.id, parsed.data.id))
    .limit(1);

  if (!row) {
    return { ok: false, error: "Media not found", code: "not_found" };
  }
  if (!canManageOrOwn(user, row.ownerId, "media", "delete")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
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
