"use server";

import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
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

const bulkAssignSchema = z.object({
  destinationId: z.string().uuid(),
  // JSON-encoded array in the form field; parsed + validated below.
  mediaAssetIds: z.array(z.string().uuid()).min(1).max(500),
  lang: z.enum(["en", "es"]),
});

/**
 * Assign many media assets to one destination in a single call. Same
 * gates as the single assign: presence-at-destination for plain
 * creators, per-asset owner check, ready-status check. Assets that
 * fail a check are skipped (reported in `skipped`), not fatal — the
 * point of the bulk tool is to move a big library in one pass, and a
 * single in-flight upload shouldn't abort the other 199 files.
 */
export async function bulkAssignMediaToDestination(
  formData: FormData,
): Promise<Result<{ destinationId: string; assigned: number; skipped: number }>> {
  let ids: unknown;
  try {
    ids = JSON.parse(String(formData.get("mediaAssetIds") ?? "[]"));
  } catch {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const parsed = bulkAssignSchema.safeParse({
    destinationId: String(formData.get("destinationId") ?? ""),
    mediaAssetIds: ids,
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

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

  const mediaRows = await db
    .select({
      id: schema.mediaAssets.id,
      ownerId: schema.mediaAssets.ownerId,
      status: schema.mediaAssets.status,
      deletedAt: schema.mediaAssets.deletedAt,
    })
    .from(schema.mediaAssets)
    .where(inArray(schema.mediaAssets.id, parsed.data.mediaAssetIds));

  const eligible = mediaRows.filter(
    (m) =>
      m.status === "ready" &&
      m.deletedAt === null &&
      canManageOrOwn(user, m.ownerId, "media", "update"),
  );
  const skipped = parsed.data.mediaAssetIds.length - eligible.length;

  if (eligible.length === 0) {
    return {
      ok: false,
      error: "None of the selected files are ready to assign",
      code: "no_eligible_media",
    };
  }

  const inserted = await db
    .insert(schema.destinationMediaAssets)
    .values(
      eligible.map((m) => ({
        destinationId: parsed.data.destinationId,
        mediaAssetId: m.id,
        assignedBy: user.id,
      })),
    )
    .onConflictDoNothing({
      target: [
        schema.destinationMediaAssets.destinationId,
        schema.destinationMediaAssets.mediaAssetId,
      ],
    })
    .returning({ mediaAssetId: schema.destinationMediaAssets.mediaAssetId });

  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}`);
  revalidatePath(`/${parsed.data.lang}/creator/media`);
  return {
    ok: true,
    data: {
      destinationId: parsed.data.destinationId,
      assigned: inserted.length,
      skipped,
    },
  };
}

const autoAssignSchema = z.object({
  lang: z.enum(["en", "es"]),
});

/**
 * One-click backfill: every panorama/poster already referenced by a
 * scene becomes an explicit library assignment on that scene's
 * destination. This is the bulk "move all current media to its tour"
 * tool — the auto-scene rule already *surfaces* these files in each
 * destination's library, and this promotes them to explicit rows so
 * the per-tour library is the durable source of truth.
 *
 * Scope mirrors listMediaForDestination: plain creators backfill only
 * their own scenes/media; site_manager with media.update (and admins)
 * backfill every scene, with the per-asset canManageOrOwn check as the
 * final defensive gate.
 */
export async function autoAssignSceneMediaToDestinations(
  formData: FormData,
): Promise<Result<{ assigned: number }>> {
  const parsed = autoAssignSchema.safeParse({
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);
  const manageAll = canManage(user, "media", "update");

  const sceneRows = await db
    .select({
      destinationId: schema.scenes.destinationId,
      panorama: schema.scenes.panoramaMediaId,
      poster: schema.scenes.posterMediaId,
    })
    .from(schema.scenes)
    .where(
      manageAll
        ? or(isNotNull(schema.scenes.panoramaMediaId), isNotNull(schema.scenes.posterMediaId))
        : and(
            eq(schema.scenes.ownerId, user.id),
            or(isNotNull(schema.scenes.panoramaMediaId), isNotNull(schema.scenes.posterMediaId)),
          ),
    );

  const pairKeys = new Set<string>();
  const pairs: Array<{ destinationId: string; mediaAssetId: string }> = [];
  for (const row of sceneRows) {
    // Scenes not yet attached to a destination have nothing to backfill.
    if (!row.destinationId) continue;
    for (const mediaId of [row.panorama, row.poster]) {
      if (!mediaId) continue;
      const key = `${row.destinationId}:${mediaId}`;
      if (pairKeys.has(key)) continue;
      pairKeys.add(key);
      pairs.push({ destinationId: row.destinationId, mediaAssetId: mediaId });
    }
  }
  if (pairs.length === 0) {
    return { ok: true, data: { assigned: 0 } };
  }

  // Per-asset defensive gate: only ready, undeleted media the caller
  // owns (or can manage) gets promoted, matching the single-assign path.
  const mediaIds = Array.from(new Set(pairs.map((p) => p.mediaAssetId)));
  const mediaRows = await db
    .select({
      id: schema.mediaAssets.id,
      ownerId: schema.mediaAssets.ownerId,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        inArray(schema.mediaAssets.id, mediaIds),
        eq(schema.mediaAssets.status, "ready"),
        isNull(schema.mediaAssets.deletedAt),
      ),
    );
  const eligibleIds = new Set(
    mediaRows
      .filter((m) => canManageOrOwn(user, m.ownerId, "media", "update"))
      .map((m) => m.id),
  );
  const eligiblePairs = pairs.filter((p) => eligibleIds.has(p.mediaAssetId));
  if (eligiblePairs.length === 0) {
    return { ok: true, data: { assigned: 0 } };
  }

  const inserted = await db
    .insert(schema.destinationMediaAssets)
    .values(
      eligiblePairs.map((p) => ({
        destinationId: p.destinationId,
        mediaAssetId: p.mediaAssetId,
        assignedBy: user.id,
      })),
    )
    .onConflictDoNothing({
      target: [
        schema.destinationMediaAssets.destinationId,
        schema.destinationMediaAssets.mediaAssetId,
      ],
    })
    .returning({ mediaAssetId: schema.destinationMediaAssets.mediaAssetId });

  revalidatePath(`/${parsed.data.lang}/creator/media`);
  revalidatePath(`/${parsed.data.lang}/creator/destinations`);
  return { ok: true, data: { assigned: inserted.length } };
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
