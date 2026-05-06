"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { creatorHasSceneAtDestination } from "@/db/queries/media";
import type { Locale } from "@/lib/locales";
import { canManage, canManageOrOwn, requireCreatorWithAuthz } from "@/lib/rbac";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

const assignSchema = z.object({
  destinationId: z.string().uuid(),
  mediaAssetId: z.string().uuid(),
  lang: z.enum(["en", "es"]),
});

const unassignSchema = assignSchema;

export async function assignMediaToDestination(
  formData: FormData,
): Promise<Result<{ destinationId: string; mediaAssetId: string }>> {
  const parsed = assignSchema.safeParse({
    destinationId: String(formData.get("destinationId") ?? ""),
    mediaAssetId: String(formData.get("mediaAssetId") ?? ""),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  // Ownership-by-presence: a creator can only manage a destination's
  // library if they've already contributed at least one scene there.
  // site_manager with media.update bypasses this — they're managing
  // on behalf of admins, not their own contributions.
  if (!canManage(user, "media", "update")) {
    const hasScene = await creatorHasSceneAtDestination(
      parsed.data.destinationId,
      user.id,
    );
    if (!hasScene) {
      return {
        ok: false,
        error: "You can only manage media for destinations where you've added at least one scene",
        code: "no_scene_at_destination",
      };
    }
  }

  const [media] = await db
    .select({
      id: schema.mediaAssets.id,
      ownerId: schema.mediaAssets.ownerId,
      status: schema.mediaAssets.status,
    })
    .from(schema.mediaAssets)
    .where(eq(schema.mediaAssets.id, parsed.data.mediaAssetId))
    .limit(1);
  if (!media) {
    return { ok: false, error: "Media not found", code: "media_not_found" };
  }
  if (!canManageOrOwn(user, media.ownerId, "media", "update")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }
  if (media.status !== "ready") {
    return {
      ok: false,
      error: "Media is still processing. Wait for it to be ready before assigning.",
      code: "media_not_ready",
    };
  }

  // ON CONFLICT DO NOTHING — assigning the same media twice is a no-op,
  // not an error. The unique index on (destination_id, media_asset_id)
  // is what enforces the no-duplicate rule.
  await db
    .insert(schema.destinationMediaAssets)
    .values({
      destinationId: parsed.data.destinationId,
      mediaAssetId: parsed.data.mediaAssetId,
      assignedBy: user.id,
    })
    .onConflictDoNothing({
      target: [
        schema.destinationMediaAssets.destinationId,
        schema.destinationMediaAssets.mediaAssetId,
      ],
    });

  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}`);
  return {
    ok: true,
    data: {
      destinationId: parsed.data.destinationId,
      mediaAssetId: parsed.data.mediaAssetId,
    },
  };
}

export async function unassignMediaFromDestination(
  formData: FormData,
): Promise<Result<{ destinationId: string; mediaAssetId: string }>> {
  const parsed = unassignSchema.safeParse({
    destinationId: String(formData.get("destinationId") ?? ""),
    mediaAssetId: String(formData.get("mediaAssetId") ?? ""),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  // Same presence gate as assign — keeps the management surface
  // symmetric. site_manager.media.update bypasses the gate to manage
  // libraries on behalf of admins.
  if (!canManage(user, "media", "update")) {
    const hasScene = await creatorHasSceneAtDestination(
      parsed.data.destinationId,
      user.id,
    );
    if (!hasScene) {
      return {
        ok: false,
        error: "You can only manage media for destinations where you've added at least one scene",
        code: "no_scene_at_destination",
      };
    }
  }

  // Owner-scope the unassign so a creator can't nuke another creator's
  // explicit assignment by knowing the destination/media IDs. site_manager
  // with media.delete bypasses (the whole point of the role).
  const [media] = await db
    .select({ id: schema.mediaAssets.id, ownerId: schema.mediaAssets.ownerId })
    .from(schema.mediaAssets)
    .where(eq(schema.mediaAssets.id, parsed.data.mediaAssetId))
    .limit(1);
  if (!media) {
    return { ok: false, error: "Media not found", code: "media_not_found" };
  }
  if (!canManageOrOwn(user, media.ownerId, "media", "delete")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }

  await db
    .delete(schema.destinationMediaAssets)
    .where(
      and(
        eq(schema.destinationMediaAssets.destinationId, parsed.data.destinationId),
        eq(schema.destinationMediaAssets.mediaAssetId, parsed.data.mediaAssetId),
      ),
    );

  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}`);
  return {
    ok: true,
    data: {
      destinationId: parsed.data.destinationId,
      mediaAssetId: parsed.data.mediaAssetId,
    },
  };
}
