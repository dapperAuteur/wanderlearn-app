"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { canManageOrOwn, requireCreatorWithAuthz } from "@/lib/rbac";
import type { Locale } from "@/lib/locales";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

const createSchema = z.object({
  destinationId: z.string().uuid(),
  panoramaMediaId: z.string().uuid(),
  name: z.string().min(2).max(200),
  caption: z.string().max(500).optional(),
  lang: z.enum(["en", "es"]),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
  destinationId: z.string().uuid(),
  lang: z.enum(["en", "es"]),
});

const replacePanoramaSchema = z.object({
  sceneId: z.string().uuid(),
  destinationId: z.string().uuid(),
  panoramaMediaId: z.string().uuid(),
  lang: z.enum(["en", "es"]),
});

const updateSchema = z.object({
  sceneId: z.string().uuid(),
  destinationId: z.string().uuid(),
  name: z.string().min(2).max(200),
  caption: z.string().max(500).optional(),
  lang: z.enum(["en", "es"]),
});

const startOrientationSchema = z.object({
  sceneId: z.string().uuid(),
  destinationId: z.string().uuid(),
  // PSV returns yaw in radians [-PI, PI] and pitch in radians [-PI/2, PI/2].
  // Store whatever PSV gives us. Null clears the saved orientation.
  startYaw: z.number().finite().nullable(),
  startPitch: z.number().finite().nullable(),
  lang: z.enum(["en", "es"]),
});

const rollOffsetSchema = z.object({
  sceneId: z.string().uuid(),
  destinationId: z.string().uuid(),
  // Degrees. Clamped to ±15° — anything outside that range is almost
  // certainly a re-capture rather than a horizon correction, and PSV
  // visuals at extreme rolls just look broken. Null clears the offset.
  rollOffsetDeg: z.number().finite().min(-15).max(15).nullable(),
  lang: z.enum(["en", "es"]),
});

const posterSchema = z.object({
  sceneId: z.string().uuid(),
  destinationId: z.string().uuid(),
  // null means "clear the saved poster" (scene falls back to derived default).
  posterMediaId: z.string().uuid().nullable(),
  lang: z.enum(["en", "es"]),
});

const audioSchema = z.object({
  sceneId: z.string().uuid(),
  destinationId: z.string().uuid(),
  audioMediaId: z.string().uuid().nullable(),
  /** Loop the bed, or play once and stop. Defaults true — see scenes.audioLoop. */
  audioLoop: z.boolean(),
  /** Text alternative for the ambient bed. Null when the creator clears it. */
  audioDescription: z.string().trim().max(500).nullable(),
  lang: z.string().min(2).max(5),
});

const iconOpacitySchema = z.object({
  sceneId: z.string().uuid(),
  destinationId: z.string().uuid(),
  /** Null means "inherit the tour's value". */
  sceneLinkIconOpacity: z.number().int().min(0).max(100).nullable(),
  hotspotIconOpacity: z.number().int().min(0).max(100).nullable(),
  lang: z.string().min(2).max(5),
});

const statusToggleSchema = z.object({
  sceneId: z.string().uuid(),
  destinationId: z.string().uuid(),
  lang: z.enum(["en", "es"]),
});

function parseCreateFormData(formData: FormData) {
  return {
    destinationId: String(formData.get("destinationId") ?? ""),
    panoramaMediaId: String(formData.get("panoramaMediaId") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    caption: String(formData.get("caption") ?? "").trim() || undefined,
    lang: String(formData.get("lang") ?? "en") as Locale,
  };
}

export async function createScene(formData: FormData): Promise<Result<{ id: string }>> {
  const parsed = createSchema.safeParse(parseCreateFormData(formData));
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const [mediaRow] = await db
    .select({
      id: schema.mediaAssets.id,
      kind: schema.mediaAssets.kind,
      status: schema.mediaAssets.status,
      ownerId: schema.mediaAssets.ownerId,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.id, parsed.data.panoramaMediaId),
        eq(schema.mediaAssets.ownerId, user.id),
      ),
    )
    .limit(1);

  if (!mediaRow) {
    return {
      ok: false,
      error: "Panorama media not found or not owned by you",
      code: "media_not_found",
    };
  }
  if (mediaRow.kind !== "photo_360" && mediaRow.kind !== "video_360") {
    return {
      ok: false,
      error: "Panorama must be a 360° photo or 360° video",
      code: "invalid_media_kind",
    };
  }
  if (mediaRow.status !== "ready") {
    return {
      ok: false,
      error: "Panorama is still processing. Wait for it to be ready before creating a scene.",
      code: "media_not_ready",
    };
  }

  const [row] = await db
    .insert(schema.scenes)
    .values({
      ownerId: user.id,
      destinationId: parsed.data.destinationId,
      name: parsed.data.name,
      caption: parsed.data.caption,
      panoramaMediaId: parsed.data.panoramaMediaId,
      posterMediaId: mediaRow.kind === "photo_360" ? parsed.data.panoramaMediaId : null,
    })
    .returning({ id: schema.scenes.id });

  if (!row) {
    return { ok: false, error: "Failed to create scene", code: "db_insert_failed" };
  }

  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}`);
  return { ok: true, data: { id: row.id } };
}

const bulkCreateSchema = z.object({
  destinationId: z.string().uuid(),
  panoramaMediaIds: z.array(z.string().uuid()).min(1).max(40),
  lang: z.enum(["en", "es"]),
});

/**
 * Creates one scene per selected panorama, in a single action.
 *
 * BAM: "there should be a button to convert all assigned files or select multiple
 * files that are already assigned to a destination into a tour." A twelve-room tour
 * previously meant twelve round trips through the new-scene form, which is the single
 * biggest drag on the museum-partner workflow.
 *
 * Scene names come from the media display name, falling back to the original filename
 * and then a short id, so the creator gets something recognisable to rename rather
 * than a wall of "Untitled". Nothing is invented — the name is whatever the file was
 * already called.
 *
 * Skips rather than fails on unusable rows (wrong kind, still processing, not owned).
 * On a batch of thirty, a partial success with a skipped count is far more useful than
 * an all-or-nothing error.
 */
export async function bulkCreateScenes(
  input: z.infer<typeof bulkCreateSchema>,
): Promise<Result<{ created: number; skipped: number }>> {
  const parsed = bulkCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const rows = await db
    .select({
      id: schema.mediaAssets.id,
      kind: schema.mediaAssets.kind,
      status: schema.mediaAssets.status,
      displayName: schema.mediaAssets.displayName,
      metadata: schema.mediaAssets.metadata,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        inArray(schema.mediaAssets.id, parsed.data.panoramaMediaIds),
        eq(schema.mediaAssets.ownerId, user.id),
        isNull(schema.mediaAssets.deletedAt),
      ),
    );

  const usable = rows.filter(
    (r) => (r.kind === "photo_360" || r.kind === "video_360") && r.status === "ready",
  );
  const skipped = parsed.data.panoramaMediaIds.length - usable.length;
  if (usable.length === 0) {
    return { ok: false, error: "No usable panoramas selected", code: "no_usable_media" };
  }

  // Preserve the order the creator picked rather than whatever the DB returned, so
  // scene order matches what they saw on screen.
  const byId = new Map(usable.map((r) => [r.id, r]));
  const ordered = parsed.data.panoramaMediaIds
    .map((id) => byId.get(id))
    .filter((r): r is (typeof usable)[number] => Boolean(r));

  await db.insert(schema.scenes).values(
    ordered.map((media) => {
      const meta = media.metadata as { filename?: string } | null;
      const name =
        media.displayName?.trim() ||
        meta?.filename?.replace(/\.[^.]+$/, "") ||
        media.id.slice(0, 8);
      return {
        ownerId: user.id,
        destinationId: parsed.data.destinationId,
        name: name.slice(0, 200),
        caption: null,
        panoramaMediaId: media.id,
        posterMediaId: media.kind === "photo_360" ? media.id : null,
      };
    }),
  );

  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}`);
  return { ok: true, data: { created: ordered.length, skipped } };
}

export async function replaceScenePanorama(
  formData: FormData,
): Promise<Result<{ id: string }>> {
  const parsed = replacePanoramaSchema.safeParse({
    sceneId: String(formData.get("sceneId") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    panoramaMediaId: String(formData.get("panoramaMediaId") ?? ""),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const [scene] = await db
    .select({ id: schema.scenes.id, ownerId: schema.scenes.ownerId })
    .from(schema.scenes)
    .where(eq(schema.scenes.id, parsed.data.sceneId))
    .limit(1);
  if (!scene) {
    return { ok: false, error: "Scene not found", code: "not_found" };
  }
  if (!canManageOrOwn(user, scene.ownerId, "scenes", "update")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }

  const [mediaRow] = await db
    .select({
      id: schema.mediaAssets.id,
      kind: schema.mediaAssets.kind,
      status: schema.mediaAssets.status,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.id, parsed.data.panoramaMediaId),
        eq(schema.mediaAssets.ownerId, user.id),
      ),
    )
    .limit(1);

  if (!mediaRow) {
    return {
      ok: false,
      error: "Panorama media not found or not owned by you",
      code: "media_not_found",
    };
  }
  if (mediaRow.kind !== "photo_360" && mediaRow.kind !== "video_360") {
    return {
      ok: false,
      error: "Panorama must be a 360° photo or 360° video",
      code: "invalid_media_kind",
    };
  }
  if (mediaRow.status !== "ready") {
    return { ok: false, error: "Panorama is still processing", code: "media_not_ready" };
  }

  await db
    .update(schema.scenes)
    .set({
      panoramaMediaId: parsed.data.panoramaMediaId,
      posterMediaId: mediaRow.kind === "photo_360" ? parsed.data.panoramaMediaId : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.scenes.id, parsed.data.sceneId));

  revalidatePath(
    `/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}/scenes/${parsed.data.sceneId}`,
  );
  return { ok: true, data: { id: parsed.data.sceneId } };
}

export async function updateScene(formData: FormData): Promise<Result<{ id: string }>> {
  const parsed = updateSchema.safeParse({
    sceneId: String(formData.get("sceneId") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    caption: String(formData.get("caption") ?? "").trim() || undefined,
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const [scene] = await db
    .select({ id: schema.scenes.id, ownerId: schema.scenes.ownerId })
    .from(schema.scenes)
    .where(eq(schema.scenes.id, parsed.data.sceneId))
    .limit(1);
  if (!scene) {
    return { ok: false, error: "Scene not found", code: "not_found" };
  }
  if (!canManageOrOwn(user, scene.ownerId, "scenes", "update")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }

  await db
    .update(schema.scenes)
    .set({
      name: parsed.data.name,
      caption: parsed.data.caption ?? null,
      updatedAt: new Date(),
    })
    .where(eq(schema.scenes.id, parsed.data.sceneId));

  revalidatePath(
    `/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}/scenes/${parsed.data.sceneId}`,
  );
  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}`);
  return { ok: true, data: { id: parsed.data.sceneId } };
}


const renameSceneSchema = z.object({
  sceneId: z.string().uuid(),
  destinationId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  lang: z.enum(["en", "es"]),
});

/**
 * Renames a scene and nothing else.
 *
 * Deliberately NOT updateScene: that action writes `caption: parsed.caption ??
 * null`, so a caller that only knows the new name would silently erase the
 * scene's caption. A rename from a list view has no caption field to send, so
 * it needs a write that touches one column.
 *
 * Scene names are independent of the media file's display name — bulk creation
 * seeds the name from the file, then they diverge on purpose. Renaming a file
 * must not rename rooms across every tour that uses it.
 */
export async function renameScene(formData: FormData): Promise<Result<{ id: string }>> {
  const parsed = renameSceneSchema.safeParse({
    sceneId: String(formData.get("sceneId") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    name: String(formData.get("name") ?? ""),
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const [scene] = await db
    .select({ id: schema.scenes.id, ownerId: schema.scenes.ownerId })
    .from(schema.scenes)
    .where(eq(schema.scenes.id, parsed.data.sceneId))
    .limit(1);
  if (!scene) {
    return { ok: false, error: "Scene not found", code: "not_found" };
  }
  if (!canManageOrOwn(user, scene.ownerId, "scenes", "update")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }

  await db
    .update(schema.scenes)
    .set({ name: parsed.data.name, updatedAt: new Date() })
    .where(eq(schema.scenes.id, parsed.data.sceneId));

  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}/connections`);
  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}`);
  revalidatePath(
    `/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}/scenes/${parsed.data.sceneId}`,
  );
  return { ok: true, data: { id: parsed.data.sceneId } };
}

export async function updateSceneStartOrientation(
  formData: FormData,
): Promise<Result<{ id: string }>> {
  const rawYaw = formData.get("startYaw");
  const rawPitch = formData.get("startPitch");
  const parseNullableNumber = (raw: FormDataEntryValue | null) => {
    if (raw === null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  };
  const parsed = startOrientationSchema.safeParse({
    sceneId: String(formData.get("sceneId") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    startYaw: parseNullableNumber(rawYaw),
    startPitch: parseNullableNumber(rawPitch),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const [scene] = await db
    .select({ id: schema.scenes.id, ownerId: schema.scenes.ownerId })
    .from(schema.scenes)
    .where(eq(schema.scenes.id, parsed.data.sceneId))
    .limit(1);
  if (!scene) {
    return { ok: false, error: "Scene not found", code: "not_found" };
  }
  if (!canManageOrOwn(user, scene.ownerId, "scenes", "update")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }

  await db
    .update(schema.scenes)
    .set({
      startYaw: parsed.data.startYaw,
      startPitch: parsed.data.startPitch,
      updatedAt: new Date(),
    })
    .where(eq(schema.scenes.id, parsed.data.sceneId));

  revalidatePath(
    `/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}/scenes/${parsed.data.sceneId}`,
  );
  revalidatePath(
    `/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}/scenes/${parsed.data.sceneId}/edit`,
  );
  return { ok: true, data: { id: parsed.data.sceneId } };
}

export async function updateSceneRollOffset(
  formData: FormData,
): Promise<Result<{ id: string; rollOffsetDeg: number | null }>> {
  const raw = formData.get("rollOffsetDeg");
  const parseNullableNumber = (v: FormDataEntryValue | null) => {
    if (v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  };
  const parsed = rollOffsetSchema.safeParse({
    sceneId: String(formData.get("sceneId") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    rollOffsetDeg: parseNullableNumber(raw),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const [scene] = await db
    .select({ id: schema.scenes.id, ownerId: schema.scenes.ownerId })
    .from(schema.scenes)
    .where(eq(schema.scenes.id, parsed.data.sceneId))
    .limit(1);
  if (!scene) {
    return { ok: false, error: "Scene not found", code: "not_found" };
  }
  if (!canManageOrOwn(user, scene.ownerId, "scenes", "update")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }

  await db
    .update(schema.scenes)
    .set({
      rollOffsetDeg: parsed.data.rollOffsetDeg,
      updatedAt: new Date(),
    })
    .where(eq(schema.scenes.id, parsed.data.sceneId));

  revalidatePath(
    `/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}/scenes/${parsed.data.sceneId}`,
  );
  return {
    ok: true,
    data: { id: parsed.data.sceneId, rollOffsetDeg: parsed.data.rollOffsetDeg },
  };
}

export async function updateScenePoster(
  formData: FormData,
): Promise<Result<{ id: string; posterMediaId: string | null }>> {
  const rawPoster = String(formData.get("posterMediaId") ?? "");
  const parsed = posterSchema.safeParse({
    sceneId: String(formData.get("sceneId") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    posterMediaId: rawPoster.length > 0 ? rawPoster : null,
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const [scene] = await db
    .select({ id: schema.scenes.id, ownerId: schema.scenes.ownerId })
    .from(schema.scenes)
    .where(eq(schema.scenes.id, parsed.data.sceneId))
    .limit(1);
  if (!scene) {
    return { ok: false, error: "Scene not found", code: "not_found" };
  }
  if (!canManageOrOwn(user, scene.ownerId, "scenes", "update")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }

  if (parsed.data.posterMediaId !== null) {
    const [mediaRow] = await db
      .select({
        id: schema.mediaAssets.id,
        kind: schema.mediaAssets.kind,
        status: schema.mediaAssets.status,
      })
      .from(schema.mediaAssets)
      .where(
        and(
          eq(schema.mediaAssets.id, parsed.data.posterMediaId),
          eq(schema.mediaAssets.ownerId, user.id),
        ),
      )
      .limit(1);

    if (!mediaRow) {
      return {
        ok: false,
        error: "Poster media not found or not owned by you",
        code: "media_not_found",
      };
    }
    if (
      mediaRow.kind !== "image" &&
      mediaRow.kind !== "photo_360" &&
      mediaRow.kind !== "screenshot"
    ) {
      return {
        ok: false,
        error: "Poster must be an image, 360° photo, or screenshot",
        code: "invalid_media_kind",
      };
    }
    if (mediaRow.status !== "ready") {
      return {
        ok: false,
        error: "Poster media is still processing. Wait for it to be ready.",
        code: "media_not_ready",
      };
    }
  }

  await db
    .update(schema.scenes)
    .set({
      posterMediaId: parsed.data.posterMediaId,
      updatedAt: new Date(),
    })
    .where(eq(schema.scenes.id, parsed.data.sceneId));

  revalidatePath(
    `/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}/scenes/${parsed.data.sceneId}`,
  );
  revalidatePath(
    `/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}/scenes/${parsed.data.sceneId}/edit`,
  );
  return {
    ok: true,
    data: { id: parsed.data.sceneId, posterMediaId: parsed.data.posterMediaId },
  };
}

export async function publishScene(
  formData: FormData,
): Promise<Result<{ id: string; status: "published" }>> {
  const parsed = statusToggleSchema.safeParse({
    sceneId: String(formData.get("sceneId") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const [scene] = await db
    .select({
      id: schema.scenes.id,
      ownerId: schema.scenes.ownerId,
      status: schema.scenes.status,
      publishedAt: schema.scenes.publishedAt,
    })
    .from(schema.scenes)
    .where(eq(schema.scenes.id, parsed.data.sceneId))
    .limit(1);
  if (!scene) {
    return { ok: false, error: "Scene not found", code: "not_found" };
  }
  if (!canManageOrOwn(user, scene.ownerId, "scenes", "update")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }
  if (scene.status === "published") {
    return { ok: true, data: { id: scene.id, status: "published" } };
  }

  const now = new Date();
  await db
    .update(schema.scenes)
    .set({
      status: "published",
      // Preserve the original publish timestamp on republish so analytics
      // distinguish first-publish from re-publish.
      publishedAt: scene.publishedAt ?? now,
      updatedAt: now,
    })
    .where(eq(schema.scenes.id, parsed.data.sceneId));

  revalidatePath(
    `/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}/scenes/${parsed.data.sceneId}`,
  );
  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}`);
  // Public tour cache must drop so learners see the newly-live scene.
  revalidatePath(`/${parsed.data.lang}/tours`);
  return { ok: true, data: { id: parsed.data.sceneId, status: "published" } };
}

export async function unpublishScene(
  formData: FormData,
): Promise<Result<{ id: string; status: "unpublished" }>> {
  const parsed = statusToggleSchema.safeParse({
    sceneId: String(formData.get("sceneId") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const [scene] = await db
    .select({
      id: schema.scenes.id,
      ownerId: schema.scenes.ownerId,
      status: schema.scenes.status,
    })
    .from(schema.scenes)
    .where(eq(schema.scenes.id, parsed.data.sceneId))
    .limit(1);
  if (!scene) {
    return { ok: false, error: "Scene not found", code: "not_found" };
  }
  if (!canManageOrOwn(user, scene.ownerId, "scenes", "update")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }
  if (scene.status === "unpublished" || scene.status === "draft") {
    return { ok: true, data: { id: scene.id, status: "unpublished" } };
  }

  await db
    .update(schema.scenes)
    .set({ status: "unpublished", updatedAt: new Date() })
    .where(eq(schema.scenes.id, parsed.data.sceneId));

  revalidatePath(
    `/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}/scenes/${parsed.data.sceneId}`,
  );
  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}`);
  revalidatePath(`/${parsed.data.lang}/tours`);
  return { ok: true, data: { id: parsed.data.sceneId, status: "unpublished" } };
}

export async function deleteScene(formData: FormData): Promise<Result<null>> {
  const parsed = deleteSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const [scene] = await db
    .select({ ownerId: schema.scenes.ownerId })
    .from(schema.scenes)
    .where(eq(schema.scenes.id, parsed.data.id))
    .limit(1);
  if (!scene) {
    return { ok: false, error: "Scene not found", code: "not_found" };
  }
  if (!canManageOrOwn(user, scene.ownerId, "scenes", "delete")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }

  await db.delete(schema.scenes).where(eq(schema.scenes.id, parsed.data.id));

  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}`);
  return { ok: true, data: null };
}


/**
 * Attach or clear a scene's ambient audio bed.
 *
 * Ownership is re-checked against the caller here, not just filtered in the
 * picker, so a crafted request cannot attach another creator's recording.
 */
/**
 * Per-scene override for link-arrow and hotspot-pin opacity.
 *
 * Empty string stores NULL — "inherit the tour's" rather than a number that
 * equals it today and would stop tracking it tomorrow. The floor is applied on
 * read (src/lib/icon-opacity.ts), so a value written here that is too low is
 * clamped when rendered rather than rejected: the column stores intent, the
 * resolver enforces usability.
 */
export async function updateSceneIconOpacity(
  formData: FormData,
): Promise<Result<{ id: string }>> {
  const rawLink = String(formData.get("sceneLinkIconOpacity") ?? "").trim();
  const rawHotspot = String(formData.get("hotspotIconOpacity") ?? "").trim();
  const parsed = iconOpacitySchema.safeParse({
    sceneId: String(formData.get("sceneId") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    sceneLinkIconOpacity: rawLink === "" ? null : Number(rawLink),
    hotspotIconOpacity: rawHotspot === "" ? null : Number(rawHotspot),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang as Locale);

  const [scene] = await db
    .select({ id: schema.scenes.id, ownerId: schema.scenes.ownerId })
    .from(schema.scenes)
    .where(eq(schema.scenes.id, parsed.data.sceneId))
    .limit(1);
  if (!scene) {
    return { ok: false, error: "Scene not found", code: "not_found" };
  }
  if (!canManageOrOwn(user, scene.ownerId, "scenes", "update")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }

  await db
    .update(schema.scenes)
    .set({
      sceneLinkIconOpacity: parsed.data.sceneLinkIconOpacity,
      hotspotIconOpacity: parsed.data.hotspotIconOpacity,
      updatedAt: new Date(),
    })
    .where(eq(schema.scenes.id, parsed.data.sceneId));

  revalidatePath(
    `/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}/scenes/${parsed.data.sceneId}`,
  );
  return { ok: true, data: { id: parsed.data.sceneId } };
}

export async function updateSceneAudio(
  formData: FormData,
): Promise<Result<{ id: string; audioMediaId: string | null }>> {
  const raw = String(formData.get("audioMediaId") ?? "");
  const parsed = audioSchema.safeParse({
    sceneId: String(formData.get("sceneId") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    audioMediaId: raw.length > 0 ? raw : null,
    // A MISSING field is not a false one. `formData.get` returns null when the
    // key was never set, and treating that as "do not loop" would silently
    // switch a scene to one-shot on any caller that predates the field. Absent
    // means loop — what every scene did before the column existed.
    audioLoop:
      formData.get("audioLoop") === null
        ? true
        : String(formData.get("audioLoop")) === "true",
    // Absent means "no description", NOT the string "null" — which is exactly
    // what String(formData.get(...)) yields for a missing key.
    audioDescription: String(formData.get("audioDescription") ?? "").trim() || null,
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const [scene] = await db
    .select({ id: schema.scenes.id, ownerId: schema.scenes.ownerId })
    .from(schema.scenes)
    .where(eq(schema.scenes.id, parsed.data.sceneId))
    .limit(1);
  if (!scene) {
    return { ok: false, error: "Scene not found", code: "not_found" };
  }
  if (!canManageOrOwn(user, scene.ownerId, "scenes", "update")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }

  if (parsed.data.audioMediaId !== null) {
    const [mediaRow] = await db
      .select({
        id: schema.mediaAssets.id,
        kind: schema.mediaAssets.kind,
        status: schema.mediaAssets.status,
      })
      .from(schema.mediaAssets)
      .where(
        and(
          eq(schema.mediaAssets.id, parsed.data.audioMediaId),
          eq(schema.mediaAssets.ownerId, user.id),
        ),
      )
      .limit(1);
    if (!mediaRow) {
      return {
        ok: false,
        error: "Audio not found or not owned by you",
        code: "media_not_found",
      };
    }
    if (mediaRow.kind !== "audio") {
      return { ok: false, error: "Ambient bed must be an audio file", code: "invalid_media_kind" };
    }
    if (mediaRow.status !== "ready") {
      return {
        ok: false,
        error: "Audio is still processing. Wait for it to be ready.",
        code: "media_not_ready",
      };
    }
  }

  await db
    .update(schema.scenes)
    .set({
      audioMediaId: parsed.data.audioMediaId,
      audioLoop: parsed.data.audioLoop,
      audioDescription: parsed.data.audioDescription,
      updatedAt: new Date(),
    })
    .where(eq(schema.scenes.id, parsed.data.sceneId));

  revalidatePath(
    `/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}/scenes/${parsed.data.sceneId}`,
  );
  revalidatePath(
    `/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}/scenes/${parsed.data.sceneId}/edit`,
  );
  return { ok: true, data: { id: parsed.data.sceneId, audioMediaId: parsed.data.audioMediaId } };
}
