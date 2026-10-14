"use server";

import { and, eq, inArray, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { copyName, copySlug, planSceneCopy, planTourCopy } from "@/lib/duplicate-plan";
import { canManageOrOwn, requireCreatorWithAuthz } from "@/lib/rbac";
import type { Locale } from "@/lib/locales";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

const langSchema = z.enum(["en", "es"]);
// The word in "(copy)", from the caller's dictionary so the name is in the creator's language.
const suffixSchema = z.string().trim().min(1).max(20);

const sceneSchema = z.object({
  sceneId: z.string().uuid(),
  destinationId: z.string().uuid(),
  copySuffix: suffixSchema,
  lang: langSchema,
});

/**
 * Copies one scene inside its tour: same panorama and view settings, its
 * hotspots, its arrows out, and its moment photos. The copy is a draft owned
 * by whoever duplicated it, and nothing links to it until they add a link.
 */
export async function duplicateScene(
  input: z.input<typeof sceneSchema>,
): Promise<Result<{ sceneId: string }>> {
  const parsed = sceneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input", code: "invalid_input" };
  const { sceneId, destinationId, copySuffix, lang } = parsed.data;
  const user = await requireCreatorWithAuthz(lang as Locale);

  const [scene] = await db
    .select()
    .from(schema.scenes)
    .where(and(eq(schema.scenes.id, sceneId), eq(schema.scenes.destinationId, destinationId)))
    .limit(1);
  if (!scene) return { ok: false, error: "Scene not found", code: "not_found" };
  if (!canManageOrOwn(user, scene.ownerId, "scenes", "update")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }

  const [hotspots, outgoingLinks, momentPhotos, siblings] = await Promise.all([
    db.select().from(schema.sceneHotspots).where(eq(schema.sceneHotspots.sceneId, sceneId)),
    db.select().from(schema.sceneLinks).where(eq(schema.sceneLinks.fromSceneId, sceneId)),
    db.select().from(schema.sceneMomentPanoramas).where(eq(schema.sceneMomentPanoramas.sceneId, sceneId)),
    db.select({ name: schema.scenes.name }).from(schema.scenes).where(eq(schema.scenes.destinationId, destinationId)),
  ]);

  const plan = planSceneCopy(
    { scene, hotspots, outgoingLinks, momentPhotos },
    {
      newId: () => crypto.randomUUID(),
      ownerId: user.id,
      now: new Date(),
      name: copyName(scene.name, copySuffix, new Set(siblings.map((s) => s.name))),
    },
  );

  // All or nothing: a half-copied scene (a scene without its hotspots) is worse than none.
  await db.transaction(async (tx) => {
    await tx.insert(schema.scenes).values(plan.scene);
    if (plan.hotspots.length) await tx.insert(schema.sceneHotspots).values(plan.hotspots);
    if (plan.links.length) await tx.insert(schema.sceneLinks).values(plan.links);
    if (plan.momentPhotos.length) await tx.insert(schema.sceneMomentPanoramas).values(plan.momentPhotos);
  });

  revalidatePath(`/${lang}/creator/destinations/${destinationId}`);
  revalidatePath(`/${lang}/creator/destinations/${destinationId}/connections`);
  return { ok: true, data: { sceneId: plan.scene.id } };
}

const tourSchema = z.object({
  destinationId: z.string().uuid(),
  copySuffix: suffixSchema,
  lang: langSchema,
});

/**
 * Copies a whole tour: its settings, every scene the user may edit (with their
 * hotspots, the links between them, and moment photos), its timeline, and the
 * media assigned to it. The copy is private, has no share link, and isn't
 * placed on /tours. Hunts, course links and learners' places stay with the
 * original. Scenes the user may not edit are left out and counted.
 */
export async function duplicateTour(
  input: z.input<typeof tourSchema>,
): Promise<Result<{ destinationId: string; copied: number; skipped: number }>> {
  const parsed = tourSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input", code: "invalid_input" };
  const { destinationId, copySuffix, lang } = parsed.data;
  const user = await requireCreatorWithAuthz(lang as Locale);

  const [destination] = await db
    .select()
    .from(schema.destinations)
    .where(eq(schema.destinations.id, destinationId))
    .limit(1);
  if (!destination) return { ok: false, error: "Tour not found", code: "not_found" };

  const allScenes = await db.select().from(schema.scenes).where(eq(schema.scenes.destinationId, destinationId));
  const scenes = allScenes.filter((s) => canManageOrOwn(user, s.ownerId, "scenes", "update"));
  if (scenes.length === 0 && allScenes.length > 0) {
    return { ok: false, error: "No scenes you can copy", code: "nothing_to_copy" };
  }
  const sceneIds = scenes.map((s) => s.id);

  const [links, hotspots, moments, momentPhotos, assignments, takenSlugs, takenNames] = await Promise.all([
    sceneIds.length ? db.select().from(schema.sceneLinks).where(inArray(schema.sceneLinks.fromSceneId, sceneIds)) : [],
    sceneIds.length ? db.select().from(schema.sceneHotspots).where(inArray(schema.sceneHotspots.sceneId, sceneIds)) : [],
    db.select().from(schema.tourMoments).where(eq(schema.tourMoments.destinationId, destinationId)),
    sceneIds.length
      ? db.select().from(schema.sceneMomentPanoramas).where(inArray(schema.sceneMomentPanoramas.sceneId, sceneIds))
      : [],
    db
      .select({ mediaAssetId: schema.destinationMediaAssets.mediaAssetId })
      .from(schema.destinationMediaAssets)
      .where(eq(schema.destinationMediaAssets.destinationId, destinationId)),
    db
      .select({ slug: schema.destinations.slug })
      .from(schema.destinations)
      .where(like(schema.destinations.slug, `${destination.slug}-copy%`)),
    db
      .select({ name: schema.destinations.name })
      .from(schema.destinations)
      .where(like(schema.destinations.name, `${destination.name} (%`)),
  ]);

  const now = new Date();
  const plan = planTourCopy(
    { destination, scenes, links, hotspots, moments, momentPhotos },
    {
      newId: () => crypto.randomUUID(),
      ownerId: user.id,
      now,
      slug: copySlug(destination.slug, new Set(takenSlugs.map((r) => r.slug))),
      name: copyName(destination.name, copySuffix, new Set(takenNames.map((r) => r.name))),
    },
  );

  // Order matters for the foreign keys: tour, timeline, scenes, then what hangs off them.
  await db.transaction(async (tx) => {
    await tx.insert(schema.destinations).values(plan.destination);
    if (plan.moments.length) await tx.insert(schema.tourMoments).values(plan.moments);
    if (plan.scenes.length) await tx.insert(schema.scenes).values(plan.scenes);
    if (plan.momentPhotos.length) await tx.insert(schema.sceneMomentPanoramas).values(plan.momentPhotos);
    if (plan.links.length) await tx.insert(schema.sceneLinks).values(plan.links);
    if (plan.hotspots.length) await tx.insert(schema.sceneHotspots).values(plan.hotspots);
    if (assignments.length) {
      await tx.insert(schema.destinationMediaAssets).values(
        assignments.map((a) => ({
          destinationId: plan.destination.id,
          mediaAssetId: a.mediaAssetId,
          assignedBy: user.id,
          createdAt: now,
        })),
      );
    }
  });

  revalidatePath(`/${lang}/creator/destinations`);
  return {
    ok: true,
    data: { destinationId: plan.destination.id, copied: scenes.length, skipped: allScenes.length - scenes.length },
  };
}
