"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { requireCreator } from "@/lib/rbac";
import { slugify } from "@/lib/slug";
import { requireHotspotOwnership, requireLinkOwnership } from "@/db/queries/hotspots";
import type { Locale } from "@/lib/locales";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

const langSchema = z.enum(["en", "es"]);

const yawSchema = z.coerce.number().finite().min(-Math.PI * 2).max(Math.PI * 2);
const pitchSchema = z.coerce.number().finite().min(-Math.PI).max(Math.PI);

// ---- hotspots ------------------------------------------------------

const createHotspotSchema = z.object({
  sceneId: z.string().uuid(),
  destinationId: z.string().uuid(),
  title: z.string().min(1).max(200),
  contentHtml: z.string().max(5000).optional(),
  externalUrl: z
    .union([z.string().url().max(500), z.string().length(0)])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  yaw: yawSchema,
  pitch: pitchSchema,
  lang: langSchema,
});

const updateHotspotSchema = createHotspotSchema.extend({
  id: z.string().uuid(),
});

const deleteHotspotSchema = z.object({
  id: z.string().uuid(),
  destinationId: z.string().uuid(),
  lang: langSchema,
});

async function assertSceneOwnership(sceneId: string, userId: string) {
  const [row] = await db
    .select({ id: schema.scenes.id, ownerId: schema.scenes.ownerId })
    .from(schema.scenes)
    .where(and(eq(schema.scenes.id, sceneId), eq(schema.scenes.ownerId, userId)))
    .limit(1);
  return row ?? null;
}

function buildLocalKey(title: string, fallback: string): string {
  const slug = slugify(title);
  if (slug.length >= 2) return slug.slice(0, 120);
  return fallback.slice(0, 120);
}

function revalidateEditorPaths(
  lang: string,
  destinationId: string,
  sceneId: string,
) {
  revalidatePath(`/${lang}/creator/destinations/${destinationId}/scenes/${sceneId}`);
  revalidatePath(`/${lang}/creator/destinations/${destinationId}/scenes/${sceneId}/edit`);
}

export async function createHotspot(formData: FormData): Promise<Result<{ id: string }>> {
  const parsed = createHotspotSchema.safeParse({
    sceneId: String(formData.get("sceneId") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    title: String(formData.get("title") ?? "").trim(),
    contentHtml: String(formData.get("contentHtml") ?? "").trim() || undefined,
    externalUrl: String(formData.get("externalUrl") ?? "").trim(),
    yaw: String(formData.get("yaw") ?? "0"),
    pitch: String(formData.get("pitch") ?? "0"),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);
  const scene = await assertSceneOwnership(parsed.data.sceneId, user.id);
  if (!scene) {
    return { ok: false, error: "Scene not found", code: "scene_not_found" };
  }

  const fallbackKey = `h-${Date.now().toString(36)}`;
  let localKey = buildLocalKey(parsed.data.title, fallbackKey);

  // Retry once with the fallback key if the slug collides with an existing
  // hotspot in the same scene — unique index is (scene_id, local_key).
  const [clash] = await db
    .select({ id: schema.sceneHotspots.id })
    .from(schema.sceneHotspots)
    .where(
      and(
        eq(schema.sceneHotspots.sceneId, parsed.data.sceneId),
        eq(schema.sceneHotspots.localKey, localKey),
      ),
    )
    .limit(1);
  if (clash) localKey = fallbackKey;

  const [row] = await db
    .insert(schema.sceneHotspots)
    .values({
      sceneId: parsed.data.sceneId,
      localKey,
      yaw: parsed.data.yaw,
      pitch: parsed.data.pitch,
      title: parsed.data.title,
      contentHtml: parsed.data.contentHtml,
      externalUrl: parsed.data.externalUrl,
    })
    .returning({ id: schema.sceneHotspots.id });

  if (!row) {
    return { ok: false, error: "Failed to create hotspot", code: "db_insert_failed" };
  }

  revalidateEditorPaths(parsed.data.lang, parsed.data.destinationId, parsed.data.sceneId);
  return { ok: true, data: { id: row.id } };
}

export async function updateHotspot(formData: FormData): Promise<Result<{ id: string }>> {
  const parsed = updateHotspotSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    sceneId: String(formData.get("sceneId") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    title: String(formData.get("title") ?? "").trim(),
    contentHtml: String(formData.get("contentHtml") ?? "").trim() || undefined,
    externalUrl: String(formData.get("externalUrl") ?? "").trim(),
    yaw: String(formData.get("yaw") ?? "0"),
    pitch: String(formData.get("pitch") ?? "0"),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);
  const ownership = await requireHotspotOwnership(parsed.data.id, user.id);
  if (!ownership || ownership.sceneId !== parsed.data.sceneId) {
    return { ok: false, error: "Hotspot not found", code: "not_found" };
  }

  await db
    .update(schema.sceneHotspots)
    .set({
      title: parsed.data.title,
      contentHtml: parsed.data.contentHtml ?? null,
      externalUrl: parsed.data.externalUrl ?? null,
      yaw: parsed.data.yaw,
      pitch: parsed.data.pitch,
      updatedAt: new Date(),
    })
    .where(eq(schema.sceneHotspots.id, parsed.data.id));

  revalidateEditorPaths(parsed.data.lang, parsed.data.destinationId, parsed.data.sceneId);
  return { ok: true, data: { id: parsed.data.id } };
}

export async function deleteHotspot(formData: FormData): Promise<Result<null>> {
  const parsed = deleteHotspotSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);
  const ownership = await requireHotspotOwnership(parsed.data.id, user.id);
  if (!ownership) {
    return { ok: false, error: "Hotspot not found", code: "not_found" };
  }

  await db.delete(schema.sceneHotspots).where(eq(schema.sceneHotspots.id, parsed.data.id));

  revalidateEditorPaths(parsed.data.lang, parsed.data.destinationId, ownership.sceneId);
  return { ok: true, data: null };
}

// ---- scene links ---------------------------------------------------

const createLinkSchema = z.object({
  fromSceneId: z.string().uuid(),
  toSceneId: z.string().uuid(),
  destinationId: z.string().uuid(),
  name: z.string().max(200).optional(),
  yaw: yawSchema,
  pitch: pitchSchema,
  lang: langSchema,
});

const deleteLinkSchema = z.object({
  id: z.string().uuid(),
  destinationId: z.string().uuid(),
  lang: langSchema,
});

export async function createSceneLink(formData: FormData): Promise<Result<{ id: string }>> {
  const parsed = createLinkSchema.safeParse({
    fromSceneId: String(formData.get("fromSceneId") ?? ""),
    toSceneId: String(formData.get("toSceneId") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    name: String(formData.get("name") ?? "").trim() || undefined,
    yaw: String(formData.get("yaw") ?? "0"),
    pitch: String(formData.get("pitch") ?? "0"),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  if (parsed.data.fromSceneId === parsed.data.toSceneId) {
    return { ok: false, error: "A scene cannot link to itself", code: "self_link" };
  }
  const user = await requireCreator(parsed.data.lang);

  const fromScene = await assertSceneOwnership(parsed.data.fromSceneId, user.id);
  if (!fromScene) {
    return { ok: false, error: "Source scene not found", code: "from_scene_not_found" };
  }
  const toScene = await assertSceneOwnership(parsed.data.toSceneId, user.id);
  if (!toScene) {
    return { ok: false, error: "Target scene not found", code: "to_scene_not_found" };
  }

  const [row] = await db
    .insert(schema.sceneLinks)
    .values({
      fromSceneId: parsed.data.fromSceneId,
      toSceneId: parsed.data.toSceneId,
      name: parsed.data.name,
      yaw: parsed.data.yaw,
      pitch: parsed.data.pitch,
    })
    .returning({ id: schema.sceneLinks.id });

  if (!row) {
    return { ok: false, error: "Failed to create link", code: "db_insert_failed" };
  }

  revalidateEditorPaths(parsed.data.lang, parsed.data.destinationId, parsed.data.fromSceneId);
  return { ok: true, data: { id: row.id } };
}

export async function deleteSceneLink(formData: FormData): Promise<Result<null>> {
  const parsed = deleteLinkSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);
  const ownership = await requireLinkOwnership(parsed.data.id, user.id);
  if (!ownership) {
    return { ok: false, error: "Link not found", code: "not_found" };
  }

  await db.delete(schema.sceneLinks).where(eq(schema.sceneLinks.id, parsed.data.id));

  revalidateEditorPaths(parsed.data.lang, parsed.data.destinationId, ownership.fromSceneId);
  return { ok: true, data: null };
}
