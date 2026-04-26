import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { imageUrl, video360PanoramaUrl } from "@/lib/cloudinary";
import type { VirtualTour as VirtualTourType } from "@/components/virtual-tour/types";

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
}): Promise<AssembleResult> {
  const sceneWhere = creatorId
    ? and(
        eq(schema.scenes.destinationId, destinationId),
        eq(schema.scenes.ownerId, creatorId),
      )
    : eq(schema.scenes.destinationId, destinationId);

  const scenes = await db
    .select()
    .from(schema.scenes)
    .where(sceneWhere)
    .orderBy(asc(schema.scenes.createdAt));

  if (scenes.length === 0) {
    return { ok: false, code: "no_scenes" };
  }

  const mediaIds = Array.from(
    new Set(scenes.map((s) => s.panoramaMediaId).filter((id): id is string => Boolean(id))),
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

    tourScenes.push({
      id: scene.id,
      name: scene.name,
      caption: scene.caption ?? undefined,
      panorama: panoramaUrl,
      type: isVideo ? "video" : "photo",
      startPosition:
        scene.startYaw !== null && scene.startPitch !== null
          ? { yaw: scene.startYaw, pitch: scene.startPitch }
          : undefined,
      hotspots: (hotspotsBySceneId.get(scene.id) ?? []).map((h) => ({
        id: h.id,
        position: { yaw: h.yaw, pitch: h.pitch },
        title: h.title,
        content: h.contentHtml ?? undefined,
        externalUrl: h.externalUrl ?? undefined,
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

  const requestedStart = startSceneId
    ? tourScenes.find((s) => s.id === startSceneId)?.id
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
    },
  };
}
