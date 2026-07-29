"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { canManageOrOwn, requireCreator, requireCreatorWithAuthz } from "@/lib/rbac";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

const langSchema = z.enum(["en", "es"]);

const MAP_TEMPLATES = ["grid", "blank"] as const;

async function revalidateMapPaths(lang: string, destinationId: string) {
  revalidatePath(`/${lang}/creator/destinations/${destinationId}/connections`);
  revalidatePath(`/${lang}/creator/destinations/${destinationId}`);
  const [row] = await db
    .select({ slug: schema.destinations.slug })
    .from(schema.destinations)
    .where(eq(schema.destinations.id, destinationId))
    .limit(1);
  if (row) revalidatePath(`/${lang}/tours/${row.slug}`);
}

const setMapSourceSchema = z.object({
  id: z.string().uuid(),
  // Exactly one of these may be non-empty; both empty clears the map.
  mapMediaId: z.string().uuid().nullable(),
  mapTemplate: z.enum(MAP_TEMPLATES).nullable(),
  lang: langSchema,
});

/**
 * Sets the tour-map background: an uploaded floor-plan image, a built-in
 * template, or nothing. One action for all three so mutual exclusivity is
 * enforced in exactly one place — media and template can never both be set.
 */
export async function setDestinationMapSource(
  formData: FormData,
): Promise<Result<{ id: string }>> {
  const rawMedia = String(formData.get("mapMediaId") ?? "").trim();
  const rawTemplate = String(formData.get("mapTemplate") ?? "").trim();
  const parsed = setMapSourceSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    mapMediaId: rawMedia === "" ? null : rawMedia,
    mapTemplate: rawTemplate === "" ? null : rawTemplate,
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  if (parsed.data.mapMediaId && parsed.data.mapTemplate) {
    return { ok: false, error: "Pick an image or a template, not both", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  const [destination] = await db
    .select({ id: schema.destinations.id })
    .from(schema.destinations)
    .where(eq(schema.destinations.id, parsed.data.id))
    .limit(1);
  if (!destination) {
    return { ok: false, error: "Destination not found", code: "not_found" };
  }

  if (parsed.data.mapMediaId) {
    const [media] = await db
      .select({
        id: schema.mediaAssets.id,
        ownerId: schema.mediaAssets.ownerId,
        kind: schema.mediaAssets.kind,
        status: schema.mediaAssets.status,
        width: schema.mediaAssets.width,
        height: schema.mediaAssets.height,
      })
      .from(schema.mediaAssets)
      .where(
        and(
          eq(schema.mediaAssets.id, parsed.data.mapMediaId),
          isNull(schema.mediaAssets.deletedAt),
        ),
      )
      .limit(1);
    if (!media || media.ownerId !== user.id) {
      return { ok: false, error: "Image not found", code: "media_not_found" };
    }
    if (media.kind !== "image" || media.status !== "ready") {
      return { ok: false, error: "Pick a ready image", code: "invalid_media" };
    }
    // Dimensions are the normalized→pixel conversion basis for every pin. A
    // handful of legacy rows predate dimension capture; those need a re-upload
    // rather than a second "measure it client-side" code path downstream.
    if (media.width === null || media.height === null) {
      return {
        ok: false,
        error: "This image is missing its stored dimensions — re-upload it once",
        code: "media_missing_dimensions",
      };
    }
  }

  await db
    .update(schema.destinations)
    .set({
      mapMediaId: parsed.data.mapMediaId,
      mapTemplate: parsed.data.mapTemplate,
    })
    .where(eq(schema.destinations.id, parsed.data.id));

  await revalidateMapPaths(parsed.data.lang, parsed.data.id);
  return { ok: true, data: { id: parsed.data.id } };
}

const setPositionSchema = z.object({
  sceneId: z.string().uuid(),
  destinationId: z.string().uuid(),
  x: z.coerce.number().min(0).max(1).nullable(),
  y: z.coerce.number().min(0).max(1).nullable(),
  lang: langSchema,
});

/** Places one scene on the map (normalized 0..1), or removes it (empty pair). */
export async function setSceneMapPosition(
  formData: FormData,
): Promise<Result<{ sceneId: string }>> {
  const rawX = String(formData.get("x") ?? "").trim();
  const rawY = String(formData.get("y") ?? "").trim();
  const clearing = rawX === "" || rawY === "";
  const parsed = setPositionSchema.safeParse({
    sceneId: String(formData.get("sceneId") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    x: clearing ? null : rawX,
    y: clearing ? null : rawY,
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const [scene] = await db
    .select({
      id: schema.scenes.id,
      ownerId: schema.scenes.ownerId,
      destinationId: schema.scenes.destinationId,
    })
    .from(schema.scenes)
    .where(eq(schema.scenes.id, parsed.data.sceneId))
    .limit(1);
  if (!scene || scene.destinationId !== parsed.data.destinationId) {
    return { ok: false, error: "Scene not found", code: "not_found" };
  }
  if (!canManageOrOwn(user, scene.ownerId, "scenes", "update")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }

  await db
    .update(schema.scenes)
    .set({ mapX: parsed.data.x, mapY: parsed.data.y })
    .where(eq(schema.scenes.id, parsed.data.sceneId));

  await revalidateMapPaths(parsed.data.lang, parsed.data.destinationId);
  return { ok: true, data: { sceneId: parsed.data.sceneId } };
}

const bulkPositionsSchema = z.object({
  destinationId: z.string().uuid(),
  positions: z
    .array(
      z.object({
        sceneId: z.string().uuid(),
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
      }),
    )
    .min(1)
    .max(200),
  lang: langSchema,
});

/**
 * Auto-arrange writes: one call for the whole layout instead of N round trips.
 * Scenes the caller cannot update (someone else's, at a shared destination)
 * are skipped and counted, not failed — a partial arrangement the creator can
 * see beats an all-or-nothing error.
 */
export async function setSceneMapPositions(
  input: z.infer<typeof bulkPositionsSchema>,
): Promise<Result<{ updated: number; skipped: number }>> {
  const parsed = bulkPositionsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const ids = parsed.data.positions.map((p) => p.sceneId);
  const scenes = await db
    .select({
      id: schema.scenes.id,
      ownerId: schema.scenes.ownerId,
      destinationId: schema.scenes.destinationId,
    })
    .from(schema.scenes)
    .where(inArray(schema.scenes.id, ids));
  const byId = new Map(scenes.map((s) => [s.id, s]));

  let updated = 0;
  let skipped = 0;
  for (const pos of parsed.data.positions) {
    const scene = byId.get(pos.sceneId);
    if (
      !scene ||
      scene.destinationId !== parsed.data.destinationId ||
      !canManageOrOwn(user, scene.ownerId, "scenes", "update")
    ) {
      skipped += 1;
      continue;
    }
    await db
      .update(schema.scenes)
      .set({ mapX: pos.x, mapY: pos.y })
      .where(eq(schema.scenes.id, pos.sceneId));
    updated += 1;
  }

  await revalidateMapPaths(parsed.data.lang, parsed.data.destinationId);
  return { ok: true, data: { updated, skipped } };
}
