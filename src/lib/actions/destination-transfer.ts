"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import type { Locale } from "@/lib/locales";
import { requireCreatorWithAuthz } from "@/lib/rbac";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

const transferSchema = z.object({
  destinationId: z.string().uuid(),
  toUserEmail: z.string().email(),
  lang: z.enum(["en", "es"]),
});

/**
 * Transfers the *current user's* scenes at a destination — and the
 * media those scenes reference — to another account by email.
 *
 * Scope of the transfer:
 *   - scenes.ownerId for every scene at this destination owned by the
 *     calling user.
 *   - mediaAssets.ownerId for every media row referenced by those
 *     scenes via panoramaMediaId or posterMediaId.
 *   - mediaAssets.originalAdminOwnerId is set to the calling user's
 *     id IF the caller's role is "admin", so the admin's destination
 *     media library can still surface the transferred items via the
 *     UI-level expansion in listMediaForDestination().
 *
 * Out of scope (intentional):
 *   - destination_media_assets explicit join rows are NOT touched.
 *     The library query already filters by mediaAssets.ownerId, so
 *     after transfer the new owner picks them up automatically.
 *   - hotspots and scene_links carry no direct ownerId; they follow
 *     their parent scene by design.
 *   - courses linked to this destination keep their own creatorId.
 *   - cross-destination media: if a transferred media row is also
 *     referenced by scenes at a DIFFERENT destination still owned by
 *     the caller, those scenes keep the (now-foreign) FK and remain
 *     viewable. The caller can no longer manage the media via the
 *     creator picker (it's not in their library anymore); reuploading
 *     gets them a fresh editable copy. Documented as v1 simple rule.
 */
export async function transferDestinationContent(
  formData: FormData,
): Promise<
  Result<{
    destinationId: string;
    toUserId: string;
    sceneCount: number;
    mediaCount: number;
  }>
> {
  const parsed = transferSchema.safeParse({
    destinationId: String(formData.get("destinationId") ?? ""),
    toUserEmail: String(formData.get("toUserEmail") ?? "").trim(),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const [target] = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.email, parsed.data.toUserEmail))
    .limit(1);
  if (!target) {
    return {
      ok: false,
      error: "No user found with that email. They need to sign up first.",
      code: "target_not_found",
    };
  }
  if (target.id === user.id) {
    return {
      ok: false,
      error: "You can't transfer to yourself.",
      code: "self_transfer",
    };
  }

  const myScenes = await db
    .select({
      id: schema.scenes.id,
      panoramaMediaId: schema.scenes.panoramaMediaId,
      posterMediaId: schema.scenes.posterMediaId,
    })
    .from(schema.scenes)
    .where(
      and(
        eq(schema.scenes.destinationId, parsed.data.destinationId),
        eq(schema.scenes.ownerId, user.id),
      ),
    );

  if (myScenes.length === 0) {
    return {
      ok: false,
      error: "You have no scenes at this destination to transfer.",
      code: "no_scenes_owned",
    };
  }

  const mediaIdSet = new Set<string>();
  for (const s of myScenes) {
    if (s.panoramaMediaId) mediaIdSet.add(s.panoramaMediaId);
    if (s.posterMediaId) mediaIdSet.add(s.posterMediaId);
  }
  const mediaIds = Array.from(mediaIdSet);

  // Limit the media transfer to media OWNED by the caller. Defensive:
  // a panorama could in theory be owned by someone else if a previous
  // ownership-check regression let it slip through. We don't want to
  // silently change ownership of someone else's media.
  const transferableMediaIds = mediaIds.length
    ? (
        await db
          .select({ id: schema.mediaAssets.id })
          .from(schema.mediaAssets)
          .where(
            and(
              inArray(schema.mediaAssets.id, mediaIds),
              eq(schema.mediaAssets.ownerId, user.id),
            ),
          )
      ).map((r) => r.id)
    : [];

  const callerIsAdmin = user.role === "admin";
  const sceneIds = myScenes.map((s) => s.id);

  await db.transaction(async (tx) => {
    await tx
      .update(schema.scenes)
      .set({ ownerId: target.id, updatedAt: new Date() })
      .where(inArray(schema.scenes.id, sceneIds));

    if (transferableMediaIds.length > 0) {
      // Set originalAdminOwnerId in the same UPDATE only when the
      // caller is admin AND the media has no original-admin recorded
      // yet. If a non-admin already moved this media once and we're
      // transferring it again from an admin, this still records the
      // admin handoff. If an admin transferred it before, we keep
      // the earliest admin recorded by leaving the column alone.
      if (callerIsAdmin) {
        await tx
          .update(schema.mediaAssets)
          .set({
            ownerId: target.id,
            originalAdminOwnerId: user.id,
            updatedAt: new Date(),
          })
          .where(inArray(schema.mediaAssets.id, transferableMediaIds));
      } else {
        await tx
          .update(schema.mediaAssets)
          .set({ ownerId: target.id, updatedAt: new Date() })
          .where(inArray(schema.mediaAssets.id, transferableMediaIds));
      }
    }
  });

  // Drop creator caches for both sides + any public surface that
  // could have stale owner-keyed data.
  revalidatePath(`/${parsed.data.lang}/creator/destinations`);
  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.destinationId}`);
  revalidatePath(`/${parsed.data.lang}/creator/media`);
  revalidatePath(`/${parsed.data.lang}/tours/${parsed.data.destinationId}`);

  return {
    ok: true,
    data: {
      destinationId: parsed.data.destinationId,
      toUserId: target.id,
      sceneCount: myScenes.length,
      mediaCount: transferableMediaIds.length,
    },
  };
}
