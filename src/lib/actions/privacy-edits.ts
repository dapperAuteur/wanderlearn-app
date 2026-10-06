"use server";

import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { findMediaUses } from "@/db/queries/media-uses";
import { replaceMediaAcrossSlots } from "@/lib/actions/media";
import {
  deleteImagesByPrefix,
  destroyAsset,
  folderFor,
  getImageSize,
  transformedImageUrl,
  uploadImageFromUrl,
  waitForDerivedImage,
} from "@/lib/cloudinary";
import { planReplacement } from "@/lib/media-replace-plan";
import {
  isPrivacyRecipeEmpty,
  privacyRecipeSchema,
  privacyTransformation,
  usesGenerativeAi,
  type PrivacyRecipe,
} from "@/lib/privacy-edit";
import { canManageOrOwn, requireCreatorWithAuthz, type AuthzUser } from "@/lib/rbac";

/**
 * "Hide people and gear": turn an edit recipe into a new, standalone image and put it
 * where the old one was.
 *
 * WHY A NEW FILE AND NOT A URL PARAMETER. A blur added to the delivery URL leaves the
 * untouched original one edit of the address away, and the public id sits right in that
 * address. Baking the edit into its own asset, then swapping it into every slot, is the
 * only version of this that actually protects a person. The original is kept unless the
 * creator asks for it to be deleted, so edits can be redone from it.
 *
 * Cloudinary does the image work: Wanderlust never decodes a panorama. The bake is an
 * upload FROM a delivery URL, so the result is a plain asset with no tie to the source.
 * See plans/13-hide-people-and-gear.md for what was verified against the live account.
 */

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

/** Painted bottom patch, small JPEG. 900 KB keeps the whole call under the 1 MB action limit. */
const patchDataUrlSchema = z
  .string()
  .max(900_000)
  .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/);

const baseSchema = z.object({
  sceneId: z.string().uuid(),
  destinationId: z.string().uuid(),
  lang: z.enum(["en", "es"]),
  /** The panorama the editor was showing. If the scene has moved on, refuse. */
  currentMediaId: z.string().uuid(),
});

const editSchema = baseSchema.extend({
  recipe: privacyRecipeSchema,
  patchDataUrl: patchDataUrlSchema.nullable(),
  /**
   * The creator ticked the box saying they understand generative AI paints pixels that
   * were never photographed and that visitors will see a label. Checked here, not only in
   * the UI, because a recipe can arrive from anywhere.
   */
  aiAcknowledged: z.boolean(),
});

const applySchema = editSchema.extend({
  /** Every place the photo is used (the privacy answer), or just this scene. */
  scope: z.enum(["everywhere", "scene"]),
  /** Hard-delete the original from Cloudinary once nothing uses it. Cannot be undone. */
  deleteOriginal: z.boolean(),
  /** Localized " (edited)" for the new file's name; the client holds the dictionary. */
  displayNameSuffix: z.string().min(1).max(40),
});

type MediaRow = {
  id: string;
  ownerId: string;
  kind: string;
  status: string;
  publicId: string | null;
  width: number | null;
  height: number | null;
  displayName: string | null;
  description: string | null;
  tags: string[];
  metadata: unknown;
  deletedAt: Date | null;
};

type PrivacyEditMeta = {
  sourceMediaId: string;
  recipe: PrivacyRecipe;
  aiGenerated: boolean;
  editedAt: string;
  editedBy: string;
};

function readMeta(metadata: unknown): { filename?: string; privacyEdit?: PrivacyEditMeta } {
  return metadata && typeof metadata === "object"
    ? (metadata as { filename?: string; privacyEdit?: PrivacyEditMeta })
    : {};
}

async function loadMedia(id: string): Promise<MediaRow | null> {
  const [row] = await db
    .select({
      id: schema.mediaAssets.id,
      ownerId: schema.mediaAssets.ownerId,
      kind: schema.mediaAssets.kind,
      status: schema.mediaAssets.status,
      publicId: schema.mediaAssets.cloudinaryPublicId,
      width: schema.mediaAssets.width,
      height: schema.mediaAssets.height,
      displayName: schema.mediaAssets.displayName,
      description: schema.mediaAssets.description,
      tags: schema.mediaAssets.tags,
      metadata: schema.mediaAssets.metadata,
      deletedAt: schema.mediaAssets.deletedAt,
    })
    .from(schema.mediaAssets)
    .where(eq(schema.mediaAssets.id, id))
    .limit(1);
  return row ?? null;
}

function usablePhoto(row: MediaRow | null): row is MediaRow & { publicId: string } {
  return Boolean(
    row && row.kind === "photo_360" && row.status === "ready" && !row.deletedAt && row.publicId,
  );
}

type EditContext = {
  scene: { id: string; destinationId: string | null };
  /** What the scene shows now. */
  current: MediaRow & { publicId: string };
  /**
   * What edits are applied TO: the original when the current photo is an edited copy
   * whose original still exists, so edits never stack blur on blur.
   */
  base: MediaRow & { publicId: string };
};

async function loadEditContext(
  user: AuthzUser,
  input: z.infer<typeof baseSchema>,
): Promise<Result<EditContext>> {
  const [scene] = await db
    .select({
      id: schema.scenes.id,
      ownerId: schema.scenes.ownerId,
      destinationId: schema.scenes.destinationId,
      panoramaMediaId: schema.scenes.panoramaMediaId,
    })
    .from(schema.scenes)
    .where(eq(schema.scenes.id, input.sceneId))
    .limit(1);
  if (!scene || scene.destinationId !== input.destinationId) {
    return { ok: false, error: "Scene not found", code: "not_found" };
  }
  if (!canManageOrOwn(user, scene.ownerId, "scenes", "update")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }
  if (scene.panoramaMediaId !== input.currentMediaId) {
    return {
      ok: false,
      error: "This scene's photo changed since the page loaded. Reload and try again.",
      code: "stale",
    };
  }
  const current = await loadMedia(scene.panoramaMediaId);
  if (!usablePhoto(current)) {
    return {
      ok: false,
      error: "Only a ready 360 photo can be edited here.",
      code: "not_a_photo",
    };
  }
  if (!canManageOrOwn(user, current.ownerId, "media", "update")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }
  const sourceId = readMeta(current.metadata).privacyEdit?.sourceMediaId;
  const source = sourceId ? await loadMedia(sourceId) : null;
  const base = usablePhoto(source) ? source : current;
  return { ok: true, data: { scene, current, base } };
}

const patchPrefix = (sceneId: string) => `${folderFor("image")}/privacy-patches/${sceneId}-`;

/** Refuse a generative edit the creator has not explicitly acknowledged. */
function aiGate(recipe: PrivacyRecipe, acknowledged: boolean): Result<null> {
  if (usesGenerativeAi(recipe) && !acknowledged) {
    return {
      ok: false,
      error: "Generative AI edits need the acknowledgement ticked first.",
      code: "ai_not_acknowledged",
    };
  }
  return { ok: true, data: null };
}

/** Pixel size of the photo edits are applied to: the row when it knows, else Cloudinary. */
async function sizeOf(
  media: MediaRow & { publicId: string },
): Promise<{ width: number; height: number } | undefined> {
  if (media.width && media.height) return { width: media.width, height: media.height };
  return (await getImageSize(media.publicId)) ?? undefined;
}

/**
 * Upload the browser-painted bottom patch as a throwaway helper asset, named by content
 * so the same patch is never stored twice. Deleted after the bake.
 */
async function uploadPatch(
  sceneId: string,
  recipe: PrivacyRecipe,
  dataUrl: string | null,
): Promise<Result<string | undefined>> {
  if (recipe.bottom.mode !== "patch") return { ok: true, data: undefined };
  if (!dataUrl) {
    return { ok: false, error: "The bottom patch was not painted.", code: "patch_missing" };
  }
  const hash = createHash("sha256").update(dataUrl).digest("hex").slice(0, 16);
  const uploaded = await uploadImageFromUrl(dataUrl, { publicId: `${patchPrefix(sceneId)}${hash}` });
  if (!uploaded.ok) {
    return { ok: false, error: "The bottom patch could not be uploaded.", code: "patch_failed" };
  }
  return { ok: true, data: uploaded.data.publicId };
}

/** photo_360 lesson blocks point at media inside JSON, outside findMediaUses. */
async function countPhotoBlocksUsing(mediaId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.contentBlocks)
    .where(
      and(
        eq(schema.contentBlocks.type, "photo_360"),
        sql`${schema.contentBlocks.data}->>'mediaId' = ${mediaId}`,
      ),
    );
  return row?.n ?? 0;
}

async function repointPhotoBlocks(fromId: string, toId: string): Promise<number> {
  const updated = await db
    .update(schema.contentBlocks)
    .set({
      data: sql`jsonb_set(${schema.contentBlocks.data}, '{mediaId}', to_jsonb(${toId}::text))`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.contentBlocks.type, "photo_360"),
        sql`${schema.contentBlocks.data}->>'mediaId' = ${fromId}`,
      ),
    )
    .returning({ id: schema.contentBlocks.id });
  return updated.length;
}

/** Move every use of `fromId` (or only this scene's) onto `toId`. */
async function swapUses(
  fromId: string,
  toId: string,
  scope: "everywhere" | "scene",
  sceneId: string,
  lang: "en" | "es",
): Promise<Result<{ replaced: number; blocks: number }>> {
  const uses = await findMediaUses(fromId);
  const plan = planReplacement({ uses, replacementKind: "photo_360" });
  const selections = plan.planned
    .filter((p) => p.eligible)
    .filter(
      (p) =>
        scope === "everywhere" ||
        (p.rowId === sceneId && (p.slot === "scene.panorama" || p.slot === "scene.poster")),
    )
    .map((p) => ({ slot: p.slot, rowId: p.rowId }));
  let replaced = 0;
  if (selections.length > 0) {
    const result = await replaceMediaAcrossSlots({ fromMediaId: fromId, toMediaId: toId, selections, lang });
    if (!result.ok) return { ok: false, error: result.error, code: result.code };
    replaced = result.data.replaced;
  }
  const blocks = scope === "everywhere" ? await repointPhotoBlocks(fromId, toId) : 0;
  return { ok: true, data: { replaced, blocks } };
}

/** Hard-delete a photo nothing points at any more. Returns how many uses blocked it. */
async function hardDeleteIfUnused(mediaId: string): Promise<{ deleted: boolean; uses: number }> {
  const [uses, blocks] = await Promise.all([findMediaUses(mediaId), countPhotoBlocksUsing(mediaId)]);
  const total = uses.length + blocks;
  if (total > 0) return { deleted: false, uses: total };
  const row = await loadMedia(mediaId);
  if (!row) return { deleted: true, uses: 0 };
  if (row.publicId) {
    const destroyed = await destroyAsset(row.publicId, "photo_360");
    if (!destroyed.ok) return { deleted: false, uses: 0 };
  }
  await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, mediaId));
  return { deleted: true, uses: 0 };
}

function revalidateScene(lang: string, destinationId: string, sceneId: string) {
  const scenePath = `/${lang}/creator/destinations/${destinationId}/scenes/${sceneId}`;
  revalidatePath(scenePath);
  revalidatePath(`${scenePath}/privacy`);
  revalidatePath(`${scenePath}/edit`);
  revalidatePath(`/${lang}/creator/destinations/${destinationId}`);
  revalidatePath(`/${lang}/creator/media`);
  revalidatePath("/[lang]/tours/[destinationSlug]", "page");
}

/**
 * Render the edit on Cloudinary and return a URL the editor can show.
 *
 * Billable: every distinct recipe is a new derived image, which is why the editor only
 * calls this when the creator presses Preview. Waits out a 423 so the viewer never
 * receives a URL that is still being generated.
 */
export async function previewPrivacyEdit(
  input: z.infer<typeof editSchema>,
): Promise<Result<{ url: string }>> {
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input", code: "invalid_input" };
  const user = await requireCreatorWithAuthz(parsed.data.lang);
  if (isPrivacyRecipeEmpty(parsed.data.recipe)) {
    return { ok: false, error: "Add at least one edit first.", code: "empty" };
  }
  const gate = aiGate(parsed.data.recipe, parsed.data.aiAcknowledged);
  if (!gate.ok) return gate;
  const ctx = await loadEditContext(user, parsed.data);
  if (!ctx.ok) return ctx;
  const patch = await uploadPatch(parsed.data.sceneId, parsed.data.recipe, parsed.data.patchDataUrl);
  if (!patch.ok) return patch;

  const components = privacyTransformation(parsed.data.recipe, {
    patchPublicId: patch.data,
    imageSize: await sizeOf(ctx.data.base),
  });
  // jpg rather than f_auto: the server warms exactly the file the browser will load, and
  // an AVIF of a 17 megapixel panorama is billed per 2 megapixels.
  const url = transformedImageUrl(ctx.data.base.publicId, components, {
    format: "jpg",
    quality: "auto",
  });
  const ready = await waitForDerivedImage(url, { deadlineMs: 40_000 });
  if (!ready.ok) {
    return ready.code === "processing"
      ? { ok: false, error: "Cloudinary is still working on it. Try again in a minute.", code: "processing" }
      : { ok: false, error: `Cloudinary could not make the preview: ${ready.error}`, code: "cloudinary_failed" };
  }
  return { ok: true, data: { url } };
}

/**
 * Bake the edit into a new photo, swap it in, and optionally delete the original.
 */
export async function applyPrivacyEdit(
  input: z.infer<typeof applySchema>,
): Promise<
  Result<{
    mediaId: string;
    replaced: number;
    blocks: number;
    originalDeleted: boolean;
    originalStillUsed: number;
  }>
> {
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input", code: "invalid_input" };
  const { lang, sceneId, destinationId, recipe, scope } = parsed.data;
  const user = await requireCreatorWithAuthz(lang);
  if (isPrivacyRecipeEmpty(recipe)) {
    return { ok: false, error: "Add at least one edit first.", code: "empty" };
  }
  const gate = aiGate(recipe, parsed.data.aiAcknowledged);
  if (!gate.ok) return gate;
  const ctx = await loadEditContext(user, parsed.data);
  if (!ctx.ok) return ctx;
  const { current, base } = ctx.data;
  const patch = await uploadPatch(sceneId, recipe, parsed.data.patchDataUrl);
  if (!patch.ok) return patch;
  const components = privacyTransformation(recipe, {
    patchPublicId: patch.data,
    imageSize: await sizeOf(base),
  });

  // The new row first, so its id can be the Cloudinary public id, exactly as the
  // signed upload flow does. Processing until the file exists: never shown to anyone.
  const baseMeta = readMeta(base.metadata);
  const stem = (baseMeta.filename ?? base.displayName ?? "panorama").replace(/\.[^.]+$/, "");
  const [row] = await db
    .insert(schema.mediaAssets)
    .values({
      ownerId: base.ownerId,
      kind: "photo_360",
      status: "processing",
      provider: "cloudinary",
      displayName: `${base.displayName ?? stem}${parsed.data.displayNameSuffix}`,
      description: base.description,
      tags: base.tags,
      metadata: {
        filename: `${stem}${parsed.data.displayNameSuffix}.jpg`,
        privacyEdit: {
          sourceMediaId: base.id,
          recipe,
          // Recorded on the file itself, so every surface that shows it (tours, lessons,
          // the library) can say so without trusting anything but the row.
          aiGenerated: usesGenerativeAi(recipe),
          editedAt: new Date().toISOString(),
          editedBy: user.id,
        } satisfies PrivacyEditMeta,
      },
    })
    .returning({ id: schema.mediaAssets.id });

  // q_auto:good first; if Cloudinary refuses the size (10 MB per image on this account),
  // once more at q_auto:eco. Production panoramas bake to about 1 to 3 MB at :good.
  let uploaded: Awaited<ReturnType<typeof uploadImageFromUrl>> | null = null;
  for (const quality of ["auto:good", "auto:eco"] as const) {
    const url = transformedImageUrl(base.publicId, components, { format: "jpg", quality });
    const ready = await waitForDerivedImage(url, { deadlineMs: 35_000 });
    if (!ready.ok) {
      await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, row.id));
      return ready.code === "processing"
        ? { ok: false, error: "Cloudinary is still working on it. Try again in a minute.", code: "processing" }
        : { ok: false, error: `Cloudinary could not make the edit: ${ready.error}`, code: "cloudinary_failed" };
    }
    uploaded = await uploadImageFromUrl(url, {
      publicId: row.id,
      folder: folderFor("photo_360"),
      context: "type=photo_360",
    });
    if (uploaded.ok) break;
  }
  if (!uploaded || !uploaded.ok) {
    await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, row.id));
    return {
      ok: false,
      error: `The edited photo could not be saved: ${uploaded && !uploaded.ok ? uploaded.error : "unknown"}`,
      code: "upload_failed",
    };
  }
  await db
    .update(schema.mediaAssets)
    .set({
      status: "ready",
      cloudinaryPublicId: uploaded.data.publicId,
      cloudinaryResourceType: uploaded.data.resourceType,
      cloudinaryFormat: uploaded.data.format,
      cloudinarySecureUrl: uploaded.data.secureUrl,
      width: uploaded.data.width,
      height: uploaded.data.height,
      sizeBytes: uploaded.data.bytes,
      updatedAt: new Date(),
    })
    .where(eq(schema.mediaAssets.id, row.id));

  // The copy belongs in the same tour libraries as the photo it replaces.
  const assignments = await db
    .select({ destinationId: schema.destinationMediaAssets.destinationId })
    .from(schema.destinationMediaAssets)
    .where(eq(schema.destinationMediaAssets.mediaAssetId, current.id));
  if (assignments.length > 0) {
    await db
      .insert(schema.destinationMediaAssets)
      .values(
        assignments.map((a) => ({
          destinationId: a.destinationId,
          mediaAssetId: row.id,
          assignedBy: user.id,
        })),
      )
      .onConflictDoNothing();
  }

  const swapped = await swapUses(current.id, row.id, scope, sceneId, lang);
  if (!swapped.ok) return swapped;

  // A previous edited copy that nothing uses any more is clutter this feature made.
  if (current.id !== base.id && readMeta(current.metadata).privacyEdit) {
    await hardDeleteIfUnused(current.id);
  }

  let originalDeleted = false;
  let originalStillUsed = 0;
  if (parsed.data.deleteOriginal) {
    const outcome = await hardDeleteIfUnused(base.id);
    originalDeleted = outcome.deleted;
    originalStillUsed = outcome.uses;
  }

  if (patch.data) await deleteImagesByPrefix(patchPrefix(sceneId));
  revalidateScene(lang, destinationId, sceneId);
  return {
    ok: true,
    data: {
      mediaId: row.id,
      replaced: swapped.data.replaced,
      blocks: swapped.data.blocks,
      originalDeleted,
      originalStillUsed,
    },
  };
}

/**
 * Put the original back everywhere the edited copy is used. The copy stays in the media
 * library, so nothing is lost and the swap can go either way.
 */
export async function revertPrivacyEdit(
  input: z.infer<typeof baseSchema>,
): Promise<Result<{ replaced: number; blocks: number }>> {
  const parsed = baseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input", code: "invalid_input" };
  const user = await requireCreatorWithAuthz(parsed.data.lang);
  const ctx = await loadEditContext(user, parsed.data);
  if (!ctx.ok) return ctx;
  const { current, base } = ctx.data;
  if (current.id === base.id) {
    return {
      ok: false,
      error: "This scene already shows the original, or the original was deleted.",
      code: "no_original",
    };
  }
  const swapped = await swapUses(current.id, base.id, "everywhere", parsed.data.sceneId, parsed.data.lang);
  if (!swapped.ok) return swapped;
  revalidateScene(parsed.data.lang, parsed.data.destinationId, parsed.data.sceneId);
  return { ok: true, data: swapped.data };
}
