import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { imageUrl, posterUrlFor, video360PanoramaUrl } from "@/lib/cloudinary";
import type { UploadKind } from "@/lib/cloudinary-urls";
import type {
  CrossTourTarget,
  VirtualTour as VirtualTourType,
} from "@/components/virtual-tour/types";

export type AssembleResult =
  | { ok: true; tour: VirtualTourType }
  | { ok: false; code: "no_scenes" | "no_ready_media" };

/**
 * Build a multi-scene VirtualTour for a destination, filtered to scenes
 * the given creator owns. Pulls in each scene's hotspots and outgoing
 * scene links so PSV can render the full interactive tour.
 *
 * The filter is "scenes owned by the course creator" (not "any scene at
 * this destination") so a creator's course never accidentally surfaces
 * another creator's footage. Cross-creator tour assembly is a future
 * feature and would need explicit consent on both sides.
 */
export async function assembleTour({
  destinationId,
  creatorId,
  startSceneId,
  title,
  description,
  arrowColor,
  pinColor,
  pinIconMediaId,
  tourArrowMediaId,
  nextDestinationId,
}: {
  destinationId: string;
  /**
   * When provided, only scenes owned by this creator appear in the tour.
   * Pass `null` (or omit) to include every scene at the destination —
   * used by the public share route, where we intentionally surface the
   * full tour regardless of which creator uploaded each scene.
   */
  creatorId?: string | null;
  startSceneId?: string | null;
  title: string;
  description?: string | null;
  /** Pass-through for destination-level styling (already preset-validated). */
  arrowColor?: string | null;
  pinColor?: string | null;
  /**
   * Destination row's `pinIconMediaId`. assembleTour resolves it to a
   * Cloudinary URL via mediaAssets and stamps it onto the returned
   * VirtualTour as `pinIconUrl`. Pass `null`/`undefined` to use the
   * default drop-pin SVG.
   */
  pinIconMediaId?: string | null;
  /**
   * Destination row's `tourArrowMediaId`. assembleTour resolves it
   * to a Cloudinary URL and stamps it onto the returned VirtualTour
   * as `arrowImageUrl`. Pass `null`/`undefined` to use PSV's default
   * chevron arrow.
   */
  tourArrowMediaId?: string | null;
  /**
   * Destination row's `nextDestinationId`. When set and the target is
   * still linkable, assembleTour stamps a `nextDestination` payload
   * (name + slug + description + poster) onto the returned tour for
   * the "Continue to {next} →" CTA.
   */
  nextDestinationId?: string | null;
}): Promise<AssembleResult> {
  // Public callers (creatorId === null) only see published scenes — drafts
  // and unpublished scenes never reach a learner. Creator-scoped callers
  // see every scene they own at any status, so the creator-preview tour
  // shows their in-progress work too.
  const sceneWhere = creatorId
    ? and(
        eq(schema.scenes.destinationId, destinationId),
        eq(schema.scenes.ownerId, creatorId),
      )
    : and(
        eq(schema.scenes.destinationId, destinationId),
        eq(schema.scenes.status, "published"),
      );

  const scenes = await db
    .select()
    .from(schema.scenes)
    .where(sceneWhere)
    .orderBy(asc(schema.scenes.createdAt));

  if (scenes.length === 0) {
    return { ok: false, code: "no_scenes" };
  }

  // Batch both panorama media (required) and poster media (optional,
  // used for grid thumbnails) into a single mediaAssets lookup.
  const mediaIds = Array.from(
    new Set(
      scenes
        .flatMap((s) => [s.panoramaMediaId, s.posterMediaId])
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const mediaRows = mediaIds.length
    ? await db
        .select({
          id: schema.mediaAssets.id,
          kind: schema.mediaAssets.kind,
          status: schema.mediaAssets.status,
          publicId: schema.mediaAssets.cloudinaryPublicId,
          secureUrl: schema.mediaAssets.cloudinarySecureUrl,
        })
        .from(schema.mediaAssets)
        .where(inArray(schema.mediaAssets.id, mediaIds))
    : [];
  // Only 'ready' media is safe to surface to a viewer. Upload/transcode
  // in-flight rows are filtered out here so PSV never receives a URL
  // Cloudinary hasn't finished producing — cleaner than catching the
  // 400 on the client. Deleted/failed rows are also excluded.
  const mediaById = new Map(
    mediaRows.filter((r) => r.status === "ready").map((r) => [r.id, r] as const),
  );

  const sceneIds = scenes.map((s) => s.id);

  const [hotspotRows, linkRows] = await Promise.all([
    db
      .select()
      .from(schema.sceneHotspots)
      .where(inArray(schema.sceneHotspots.sceneId, sceneIds)),
    db
      .select()
      .from(schema.sceneLinks)
      .where(inArray(schema.sceneLinks.fromSceneId, sceneIds)),
  ]);

  const hotspotsBySceneId = new Map<string, typeof hotspotRows>();
  for (const h of hotspotRows) {
    const arr = hotspotsBySceneId.get(h.sceneId) ?? [];
    arr.push(h);
    hotspotsBySceneId.set(h.sceneId, arr);
  }
  const linksBySceneId = new Map<string, typeof linkRows>();
  for (const l of linkRows) {
    const arr = linksBySceneId.get(l.fromSceneId) ?? [];
    arr.push(l);
    linksBySceneId.set(l.fromSceneId, arr);
  }

  // Cross-tour target resolution: batch all destination IDs referenced
  // by hotspots (via target_destination_id) plus the optional
  // nextDestinationId from the destination row itself. Resolve each to
  // a CrossTourTarget (name/slug/description/posterUrl) AND a
  // linkability boolean (owner default ?? per-destination override
  // ?? false). Targets that are no longer linkable are silently
  // dropped — hotspots that pointed at them render without a payload
  // (the viewer treats them as inert).
  const crossTourTargetIds = Array.from(
    new Set(
      [
        ...hotspotRows.map((h) => h.targetDestinationId),
        nextDestinationId ?? null,
      ].filter((id): id is string => Boolean(id)),
    ),
  );
  const crossTourTargetsById = new Map<string, CrossTourTarget>();
  if (crossTourTargetIds.length > 0) {
    const targetRows = await db
      .select({
        id: schema.destinations.id,
        slug: schema.destinations.slug,
        name: schema.destinations.name,
        description: schema.destinations.description,
        heroMediaId: schema.destinations.heroMediaId,
        override: schema.destinations.allowExternalLinkingOverride,
        anyOwnerDefault: sql<boolean>`coalesce(bool_or(${schema.users.allowExternalLinkingDefault}), false)`,
      })
      .from(schema.destinations)
      .leftJoin(schema.scenes, eq(schema.scenes.destinationId, schema.destinations.id))
      .leftJoin(schema.users, eq(schema.users.id, schema.scenes.ownerId))
      .where(inArray(schema.destinations.id, crossTourTargetIds))
      .groupBy(
        schema.destinations.id,
        schema.destinations.slug,
        schema.destinations.name,
        schema.destinations.description,
        schema.destinations.heroMediaId,
        schema.destinations.allowExternalLinkingOverride,
      );

    // Second pass: resolve hero media → poster URL for the linkable
    // targets. Reuses the existing mediaAssets table.
    const linkableHeroMediaIds = targetRows
      .filter((r) => (r.override ?? r.anyOwnerDefault) === true)
      .map((r) => r.heroMediaId)
      .filter((id): id is string => Boolean(id));
    const heroRows = linkableHeroMediaIds.length
      ? await db
          .select({
            id: schema.mediaAssets.id,
            kind: schema.mediaAssets.kind,
            status: schema.mediaAssets.status,
            publicId: schema.mediaAssets.cloudinaryPublicId,
            secureUrl: schema.mediaAssets.cloudinarySecureUrl,
          })
          .from(schema.mediaAssets)
          .where(inArray(schema.mediaAssets.id, linkableHeroMediaIds))
      : [];
    const heroById = new Map(
      heroRows.filter((r) => r.status === "ready").map((r) => [r.id, r] as const),
    );

    for (const row of targetRows) {
      const linkable = row.override === null || row.override === undefined
        ? row.anyOwnerDefault
        : row.override;
      if (!linkable) continue;
      const hero = row.heroMediaId ? heroById.get(row.heroMediaId) : undefined;
      const posterUrl = hero?.publicId
        ? posterUrlFor(hero.kind as UploadKind, hero.publicId, 800)
        : hero?.secureUrl ?? undefined;
      crossTourTargetsById.set(row.id, {
        destinationId: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description ?? undefined,
        posterUrl,
      });
    }
  }

  const tourScenes: VirtualTourType["scenes"] = [];
  for (const scene of scenes) {
    const media = mediaById.get(scene.panoramaMediaId);
    if (!media?.publicId && !media?.secureUrl) continue;
    const isVideo = media?.kind === "video_360";
    // For video_360, prefer the stored secureUrl over the on-the-fly
    // f_mp4,vc_h264,q_auto transform. Cloudinary's transform pipeline
    // 400s on videos it can't re-encode cleanly (e.g., shortened/edited
    // exports with non-standard metadata), but the browser's native
    // <video> element is far more tolerant and plays the raw MP4 fine.
    const panoramaUrl = isVideo
      ? media?.secureUrl ??
        (media?.publicId ? video360PanoramaUrl(media.publicId) : null)
      : media?.publicId
        ? imageUrl(media.publicId, { format: "auto", quality: "auto" })
        : media?.secureUrl ?? null;
    if (!panoramaUrl) continue;

    // Resolve a card thumbnail for landing-grid use. Prefer the
    // explicit posterMediaId when present and ready; otherwise derive
    // one from the panorama media: a JPG of the equirectangular for
    // photos, a frame-0 video poster for 360 video. Never a hard
    // requirement — falls back to `undefined` if nothing produces a
    // URL, and the grid card just renders without an image.
    const posterMedia = scene.posterMediaId ? mediaById.get(scene.posterMediaId) : undefined;
    let thumbnail: string | undefined;
    if (posterMedia?.publicId) {
      thumbnail = imageUrl(posterMedia.publicId, { width: 800, format: "auto", quality: "auto" });
    } else if (posterMedia?.secureUrl) {
      thumbnail = posterMedia.secureUrl;
    } else if (media?.publicId) {
      thumbnail = posterUrlFor(media.kind as UploadKind, media.publicId, 800);
    }

    tourScenes.push({
      id: scene.id,
      name: scene.name,
      caption: scene.caption ?? undefined,
      panorama: panoramaUrl,
      type: isVideo ? "video" : "photo",
      thumbnail,
      startPosition:
        scene.startYaw !== null && scene.startPitch !== null
          ? { yaw: scene.startYaw, pitch: scene.startPitch }
          : undefined,
      rollOffsetDeg: scene.rollOffsetDeg ?? undefined,
      hotspots: (hotspotsBySceneId.get(scene.id) ?? []).map((h) => ({
        id: h.id,
        position: { yaw: h.yaw, pitch: h.pitch },
        title: h.title,
        content: h.contentHtml ?? undefined,
        externalUrl: h.externalUrl ?? undefined,
        crossTourTarget: h.targetDestinationId
          ? crossTourTargetsById.get(h.targetDestinationId) ?? undefined
          : undefined,
      })),
      links: (linksBySceneId.get(scene.id) ?? []).map((link) => ({
        nodeId: link.toSceneId,
        name: link.name ?? undefined,
        position:
          link.yaw !== null && link.pitch !== null
            ? { yaw: link.yaw, pitch: link.pitch }
            : undefined,
      })),
    });
  }

  if (tourScenes.length === 0) {
    return { ok: false, code: "no_ready_media" };
  }

  // Resolve the optional pin-icon image. Drop the override silently if the
  // referenced media is missing, deleted, or not yet ready — falling back
  // to the default SVG drop-pin is better UX than rendering a broken image.
  let pinIconUrl: string | undefined;
  if (pinIconMediaId) {
    const [iconRow] = await db
      .select({
        publicId: schema.mediaAssets.cloudinaryPublicId,
        secureUrl: schema.mediaAssets.cloudinarySecureUrl,
        status: schema.mediaAssets.status,
        kind: schema.mediaAssets.kind,
      })
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.id, pinIconMediaId))
      .limit(1);
    if (iconRow && iconRow.status === "ready" && iconRow.kind === "image") {
      pinIconUrl = iconRow.publicId
        ? imageUrl(iconRow.publicId, { width: 128, format: "auto", quality: "auto" })
        : iconRow.secureUrl ?? undefined;
    }
  }

  // Same shape as pinIcon: optional creator-uploaded image used as
  // the scene-to-scene navigation arrow across the whole tour. Drop
  // silently on missing / unready / wrong-kind media.
  let arrowImageUrl: string | undefined;
  if (tourArrowMediaId) {
    const [arrowRow] = await db
      .select({
        publicId: schema.mediaAssets.cloudinaryPublicId,
        secureUrl: schema.mediaAssets.cloudinarySecureUrl,
        status: schema.mediaAssets.status,
        kind: schema.mediaAssets.kind,
      })
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.id, tourArrowMediaId))
      .limit(1);
    if (arrowRow && arrowRow.status === "ready" && arrowRow.kind === "image") {
      arrowImageUrl = arrowRow.publicId
        ? imageUrl(arrowRow.publicId, { width: 128, format: "auto", quality: "auto" })
        : arrowRow.secureUrl ?? undefined;
    }
  }

  const requestedStart = startSceneId
    ? tourScenes.find((s) => s.id === startSceneId)?.id
    : undefined;

  // Destination-level "next tour" CTA — pulled from the same
  // crossTourTargetsById map as the per-hotspot links. Silently null
  // if the target was deleted, the linking opt-in was rescinded, or
  // the destination row simply doesn't have a nextDestinationId set.
  const nextDestination = nextDestinationId
    ? crossTourTargetsById.get(nextDestinationId) ?? undefined
    : undefined;

  return {
    ok: true,
    tour: {
      slug: destinationId,
      title,
      description: description ?? undefined,
      startSceneId: requestedStart ?? tourScenes[0].id,
      scenes: tourScenes,
      arrowColor: arrowColor ?? undefined,
      pinColor: pinColor ?? undefined,
      pinIconUrl,
      arrowImageUrl,
      nextDestination,
    },
  };
}
