"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { requireCreator } from "@/lib/rbac";
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
  const user = await requireCreator(parsed.data.lang);

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
  const user = await requireCreator(parsed.data.lang);

  const [scene] = await db
    .select({ id: schema.scenes.id })
    .from(schema.scenes)
    .where(
      and(eq(schema.scenes.id, parsed.data.sceneId), eq(schema.scenes.ownerId, user.id)),
    )
    .limit(1);
  if (!scene) {
    return { ok: false, error: "Scene not found", code: "not_found" };
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
  const user = await requireCreator(parsed.data.lang);

  const [scene] = await db
    .select({ id: schema.scenes.id })
    .from(schema.scenes)
    .where(
      and(eq(schema.scenes.id, parsed.data.sceneId), eq(schema.scenes.ownerId, user.id)),
    )
    .limit(1);
  if (!scene) {
    return { ok: false, error: "Scene not found", code: "not_found" };
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
  const user = await requireCreator(parsed.data.lang);

  const [scene] = await db
    .select({ id: schema.scenes.id })
    .from(schema.scenes)
    .where(
      and(eq(schema.scenes.id, parsed.data.sceneId), eq(schema.scenes.ownerId, user.id)),
    )
    .limit(1);
  if (!scene) {
    return { ok: false, error: "Scene not found", code: "not_found" };
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

export async function deleteScene(formData: FormData): Promise<Result<null>> {
  const parsed = deleteSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  await db
    .delete(schema.scenes)
    .where(and(eq(schema.scenes.id, parsed.data.id), eq(schema.scenes.ownerId, user.id)));

  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}`);
  return { ok: true, data: null };
}
