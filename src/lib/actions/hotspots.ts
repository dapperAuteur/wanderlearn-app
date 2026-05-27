"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { isDestinationLinkable } from "@/db/queries/destinations";
import { canManageOrOwn, requireCreatorWithAuthz } from "@/lib/rbac";
import { slugify } from "@/lib/slug";
import { getHotspotWithSceneContext, getLinkWithSceneContext } from "@/db/queries/hotspots";
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
  // Cross-tour link target. Mutually exclusive with contentHtml and
  // externalUrl: setting this clears the other two on write so a
  // hotspot has exactly one "what happens when you click" payload.
  targetDestinationId: z.string().uuid().optional(),
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

async function getSceneWithOwner(sceneId: string) {
  const [row] = await db
    .select({ id: schema.scenes.id, ownerId: schema.scenes.ownerId })
    .from(schema.scenes)
    .where(eq(schema.scenes.id, sceneId))
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
  const rawTarget = String(formData.get("targetDestinationId") ?? "").trim();
  const parsed = createHotspotSchema.safeParse({
    sceneId: String(formData.get("sceneId") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    title: String(formData.get("title") ?? "").trim(),
    contentHtml: String(formData.get("contentHtml") ?? "").trim() || undefined,
    externalUrl: String(formData.get("externalUrl") ?? "").trim(),
    targetDestinationId: rawTarget.length > 0 ? rawTarget : undefined,
    yaw: String(formData.get("yaw") ?? "0"),
    pitch: String(formData.get("pitch") ?? "0"),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);
  const scene = await getSceneWithOwner(parsed.data.sceneId);
  if (!scene) {
    return { ok: false, error: "Scene not found", code: "scene_not_found" };
  }
  if (!canManageOrOwn(user, scene.ownerId, "hotspots", "create")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }

  // Validate the cross-tour target if set: must be linkable and not
  // the same destination as the hotspot's scene (no "click my hotspot
  // to go to my own tour" trick). Linkability honors per-destination
  // override + bool_or across scene-owner account defaults.
  if (parsed.data.targetDestinationId) {
    if (parsed.data.targetDestinationId === parsed.data.destinationId) {
      return {
        ok: false,
        error: "Cross-tour link can't target this same destination",
        code: "self_reference",
      };
    }
    const linkable = await isDestinationLinkable(parsed.data.targetDestinationId);
    if (!linkable) {
      return {
        ok: false,
        error: "Target destination is not currently linkable from external tours",
        code: "target_not_linkable",
      };
    }
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

  // Mutually-exclusive payloads: cross-tour wins when explicitly set,
  // clearing content + external; otherwise keep the existing semantics
  // (content + external can coexist; selection happens in the editor).
  const isCrossTour = Boolean(parsed.data.targetDestinationId);
  const [row] = await db
    .insert(schema.sceneHotspots)
    .values({
      sceneId: parsed.data.sceneId,
      localKey,
      yaw: parsed.data.yaw,
      pitch: parsed.data.pitch,
      title: parsed.data.title,
      contentHtml: isCrossTour ? null : parsed.data.contentHtml,
      externalUrl: isCrossTour ? null : parsed.data.externalUrl,
      targetDestinationId: parsed.data.targetDestinationId ?? null,
    })
    .returning({ id: schema.sceneHotspots.id });

  if (!row) {
    return { ok: false, error: "Failed to create hotspot", code: "db_insert_failed" };
  }

  revalidateEditorPaths(parsed.data.lang, parsed.data.destinationId, parsed.data.sceneId);
  return { ok: true, data: { id: row.id } };
}

export async function updateHotspot(formData: FormData): Promise<Result<{ id: string }>> {
  const rawTarget = String(formData.get("targetDestinationId") ?? "").trim();
  const parsed = updateHotspotSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    sceneId: String(formData.get("sceneId") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    title: String(formData.get("title") ?? "").trim(),
    contentHtml: String(formData.get("contentHtml") ?? "").trim() || undefined,
    externalUrl: String(formData.get("externalUrl") ?? "").trim(),
    targetDestinationId: rawTarget.length > 0 ? rawTarget : undefined,
    yaw: String(formData.get("yaw") ?? "0"),
    pitch: String(formData.get("pitch") ?? "0"),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);
  const ctx = await getHotspotWithSceneContext(parsed.data.id);
  if (!ctx || ctx.sceneId !== parsed.data.sceneId) {
    return { ok: false, error: "Hotspot not found", code: "not_found" };
  }
  if (!canManageOrOwn(user, ctx.sceneOwnerId, "hotspots", "update")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }

  // Same validation as create: target ≠ same destination, target is
  // currently linkable.
  if (parsed.data.targetDestinationId) {
    if (parsed.data.targetDestinationId === parsed.data.destinationId) {
      return {
        ok: false,
        error: "Cross-tour link can't target this same destination",
        code: "self_reference",
      };
    }
    const linkable = await isDestinationLinkable(parsed.data.targetDestinationId);
    if (!linkable) {
      return {
        ok: false,
        error: "Target destination is not currently linkable from external tours",
        code: "target_not_linkable",
      };
    }
  }

  const isCrossTour = Boolean(parsed.data.targetDestinationId);
  await db
    .update(schema.sceneHotspots)
    .set({
      title: parsed.data.title,
      // When cross-tour is set, the other payloads clear. When it's
      // unset, the form provides whatever content/external the editor
      // wants — null-coalescing keeps the existing null-clear semantics.
      contentHtml: isCrossTour ? null : (parsed.data.contentHtml ?? null),
      externalUrl: isCrossTour ? null : (parsed.data.externalUrl ?? null),
      targetDestinationId: parsed.data.targetDestinationId ?? null,
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
  const user = await requireCreatorWithAuthz(parsed.data.lang);
  const ctx = await getHotspotWithSceneContext(parsed.data.id);
  if (!ctx) {
    return { ok: false, error: "Hotspot not found", code: "not_found" };
  }
  if (!canManageOrOwn(user, ctx.sceneOwnerId, "hotspots", "delete")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }

  await db.delete(schema.sceneHotspots).where(eq(schema.sceneHotspots.id, parsed.data.id));

  revalidateEditorPaths(parsed.data.lang, parsed.data.destinationId, ctx.sceneId);
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

const updateLinkPositionSchema = z.object({
  id: z.string().uuid(),
  destinationId: z.string().uuid(),
  yaw: yawSchema,
  pitch: pitchSchema,
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
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const fromScene = await getSceneWithOwner(parsed.data.fromSceneId);
  if (!fromScene) {
    return { ok: false, error: "Source scene not found", code: "from_scene_not_found" };
  }
  if (!canManageOrOwn(user, fromScene.ownerId, "sceneLinks", "create")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }
  const toScene = await getSceneWithOwner(parsed.data.toSceneId);
  if (!toScene) {
    return { ok: false, error: "Target scene not found", code: "to_scene_not_found" };
  }
  // The target scene of a link is "borrowed" — site_managers with
  // sceneLinks.create can link any scene as a target without owning it
  // (they're already gated above on the from-scene side). Plain
  // creators still need to own both ends.
  if (!canManageOrOwn(user, toScene.ownerId, "sceneLinks", "create")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
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

export async function updateSceneLinkPosition(
  formData: FormData,
): Promise<Result<{ id: string }>> {
  const parsed = updateLinkPositionSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    yaw: String(formData.get("yaw") ?? "0"),
    pitch: String(formData.get("pitch") ?? "0"),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);
  const ctx = await getLinkWithSceneContext(parsed.data.id);
  if (!ctx) {
    return { ok: false, error: "Link not found", code: "not_found" };
  }
  if (!canManageOrOwn(user, ctx.sceneOwnerId, "sceneLinks", "update")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }

  await db
    .update(schema.sceneLinks)
    .set({ yaw: parsed.data.yaw, pitch: parsed.data.pitch })
    .where(eq(schema.sceneLinks.id, parsed.data.id));

  revalidateEditorPaths(parsed.data.lang, parsed.data.destinationId, ctx.fromSceneId);
  return { ok: true, data: { id: parsed.data.id } };
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
  const user = await requireCreatorWithAuthz(parsed.data.lang);
  const ctx = await getLinkWithSceneContext(parsed.data.id);
  if (!ctx) {
    return { ok: false, error: "Link not found", code: "not_found" };
  }
  if (!canManageOrOwn(user, ctx.sceneOwnerId, "sceneLinks", "delete")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }

  await db.delete(schema.sceneLinks).where(eq(schema.sceneLinks.id, parsed.data.id));

  revalidateEditorPaths(parsed.data.lang, parsed.data.destinationId, ctx.fromSceneId);
  return { ok: true, data: null };
}
