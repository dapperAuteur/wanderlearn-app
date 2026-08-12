import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db/client";

export type SceneRow = typeof schema.scenes.$inferSelect;

export async function listScenesForDestination(destinationId: string): Promise<SceneRow[]> {
  return db
    .select()
    .from(schema.scenes)
    .where(eq(schema.scenes.destinationId, destinationId))
    .orderBy(desc(schema.scenes.createdAt));
}

export async function getSceneById(id: string): Promise<SceneRow | null> {
  const rows = await db.select().from(schema.scenes).where(eq(schema.scenes.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function countScenesForDestination(destinationId: string): Promise<number> {
  const rows = await listScenesForDestination(destinationId);
  return rows.length;
}

export type DestinationSceneKindSummary = {
  hasPhoto: boolean;
  hasVideo: boolean;
};

/**
 * Returns whether a destination's ready scenes are photo_360, video_360,
 * or both. Used to surface the mixed-tour warning in the creator UI —
 * PSV binds one adapter per Viewer instance, so mixed tours render photos
 * only and silently drop video scenes.
 */
export async function getDestinationSceneKindSummary(
  destinationId: string,
): Promise<DestinationSceneKindSummary> {
  const rows = await db
    .selectDistinct({ kind: schema.mediaAssets.kind })
    .from(schema.scenes)
    .innerJoin(
      schema.mediaAssets,
      eq(schema.scenes.panoramaMediaId, schema.mediaAssets.id),
    )
    .where(
      and(
        eq(schema.scenes.destinationId, destinationId),
        eq(schema.mediaAssets.status, "ready"),
      ),
    );
  return {
    hasPhoto: rows.some((r) => r.kind === "photo_360"),
    hasVideo: rows.some((r) => r.kind === "video_360"),
  };
}

/**
 * Scenes at a destination whose panorama is 360° video with no transcript attached.
 *
 * Scene video is a real accessibility gap that the course publish gate never sees:
 * that gate only inspects lesson `video` / `video_360` blocks, so a tour published
 * straight from a destination — the museum-partner path, and the common one — can go
 * live with narrated video and no alternative for anyone who cannot hear it.
 *
 * Returns scene names so the warning can say which ones, rather than just a count.
 */
export async function listSceneVideosMissingTranscript(
  destinationId: string,
): Promise<{ sceneId: string; sceneName: string }[]> {
  const rows = await db
    .select({
      sceneId: schema.scenes.id,
      sceneName: schema.scenes.name,
    })
    .from(schema.scenes)
    .innerJoin(
      schema.mediaAssets,
      eq(schema.scenes.panoramaMediaId, schema.mediaAssets.id),
    )
    .where(
      and(
        eq(schema.scenes.destinationId, destinationId),
        eq(schema.mediaAssets.kind, "video_360"),
        eq(schema.mediaAssets.status, "ready"),
        isNull(schema.mediaAssets.transcriptMediaId),
      ),
    );
  return rows;
}

export type IncomingSceneLink = {
  linkId: string;
  fromSceneId: string;
  fromSceneName: string;
  arrivalYaw: number | null;
  arrivalPitch: number | null;
};

/**
 * Links that arrive AT this scene, with their arrival heading.
 *
 * Powers the "how visitors arrive here" editor. It has to be authored from the
 * target scene because that is the only place the creator can see what a given
 * heading actually looks like — the from-scene's editor shows the wrong panorama.
 */
export async function listIncomingSceneLinks(
  sceneId: string,
): Promise<IncomingSceneLink[]> {
  const fromScenes = alias(schema.scenes, "from_scenes");
  return db
    .select({
      linkId: schema.sceneLinks.id,
      fromSceneId: schema.sceneLinks.fromSceneId,
      fromSceneName: fromScenes.name,
      arrivalYaw: schema.sceneLinks.arrivalYaw,
      arrivalPitch: schema.sceneLinks.arrivalPitch,
    })
    .from(schema.sceneLinks)
    .innerJoin(fromScenes, eq(fromScenes.id, schema.sceneLinks.fromSceneId))
    .where(eq(schema.sceneLinks.toSceneId, sceneId))
    .orderBy(fromScenes.name);
}

export type Photo360Row = {
  id: string;
  cloudinaryPublicId: string | null;
  cloudinarySecureUrl: string | null;
  displayName: string | null;
  createdAt: Date;
};

export async function listPhoto360ForOwner(ownerId: string): Promise<Photo360Row[]> {
  return db
    .select({
      id: schema.mediaAssets.id,
      cloudinaryPublicId: schema.mediaAssets.cloudinaryPublicId,
      cloudinarySecureUrl: schema.mediaAssets.cloudinarySecureUrl,
      displayName: schema.mediaAssets.displayName,
      createdAt: schema.mediaAssets.createdAt,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.ownerId, ownerId),
        eq(schema.mediaAssets.kind, "photo_360"),
        eq(schema.mediaAssets.status, "ready"),
        isNull(schema.mediaAssets.deletedAt),
      ),
    )
    .orderBy(desc(schema.mediaAssets.createdAt));
}

export type PanoramaRow = {
  id: string;
  kind: "photo_360" | "video_360";
  cloudinaryPublicId: string | null;
  cloudinarySecureUrl: string | null;
  displayName: string | null;
  originalFilename: string | null;
  tags: string[];
  createdAt: Date;
};

export async function listPanoramasForOwner(ownerId: string): Promise<PanoramaRow[]> {
  const rows = await db
    .select({
      id: schema.mediaAssets.id,
      kind: schema.mediaAssets.kind,
      cloudinaryPublicId: schema.mediaAssets.cloudinaryPublicId,
      cloudinarySecureUrl: schema.mediaAssets.cloudinarySecureUrl,
      displayName: schema.mediaAssets.displayName,
      tags: schema.mediaAssets.tags,
      metadata: schema.mediaAssets.metadata,
      createdAt: schema.mediaAssets.createdAt,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.ownerId, ownerId),
        inArray(schema.mediaAssets.kind, ["photo_360", "video_360"]),
        eq(schema.mediaAssets.status, "ready"),
        isNull(schema.mediaAssets.deletedAt),
      ),
    )
    .orderBy(desc(schema.mediaAssets.createdAt));

  return rows.map((row) => {
    const meta = row.metadata as { filename?: string } | null;
    return {
      id: row.id,
      kind: row.kind as "photo_360" | "video_360",
      cloudinaryPublicId: row.cloudinaryPublicId,
      cloudinarySecureUrl: row.cloudinarySecureUrl,
      displayName: row.displayName,
      originalFilename: meta?.filename ?? null,
      tags: row.tags,
      createdAt: row.createdAt,
    };
  });
}

export type ScopedPanoramaRow = PanoramaRow & {
  /** Explicitly assigned to the destination being edited. */
  inThisTour: boolean;
  /** Explicitly assigned to any destination at all. */
  inAnyTour: boolean;
};

/**
 * Panoramas the creator owns, tagged with their relationship to one destination.
 *
 * The scene picker previously listed every panorama the creator had ever uploaded,
 * so building a tour for one place meant scrolling past every other place's content.
 * BAM: "when I'm editing Rooted with Ruby, I don't want to see MUCHO Chocolate
 * content unless I specifically ask to see that content."
 *
 * The per-tour libraries already existed (destination_media_assets); the pickers just
 * never consulted them. Returning flags rather than a filtered list keeps all three
 * views — this tour, unassigned, everything — on one query and lets the client switch
 * instantly without a round trip.
 */
/**
 * Which media belong to one destination, and which belong to any destination.
 *
 * "Belongs to this tour" is deliberately wider than the destination_media_assets
 * table: a file a scene here already uses is in this tour whether or not anyone
 * assigned it by hand. Explicit assignment alone missed most real tours — of
 * Mo*Con's 19 scene panoramas only 5 were assigned, and MUCHO had 3 scenes and 0
 * assignments — so a picker scoped that way found nothing and fell back to the
 * whole library, which is the exact "I still see all media" the scoping exists to
 * prevent.
 *
 * Shared by every scoped picker so the panorama grid and the poster grid can
 * never disagree about what this tour contains.
 */
async function destinationMediaSets(
  destinationId: string,
): Promise<{ thisTour: Set<string>; anyTour: Set<string> }> {
  const [assignments, usedHere] = await Promise.all([
    db
      .select({
        mediaAssetId: schema.destinationMediaAssets.mediaAssetId,
        destinationId: schema.destinationMediaAssets.destinationId,
      })
      .from(schema.destinationMediaAssets),
    db
      .select({
        panoramaMediaId: schema.scenes.panoramaMediaId,
        posterMediaId: schema.scenes.posterMediaId,
      })
      .from(schema.scenes)
      .where(eq(schema.scenes.destinationId, destinationId)),
  ]);

  const thisTour = new Set<string>();
  const anyTour = new Set<string>();
  for (const a of assignments) {
    anyTour.add(a.mediaAssetId);
    if (a.destinationId === destinationId) thisTour.add(a.mediaAssetId);
  }
  for (const s of usedHere) {
    if (s.panoramaMediaId) thisTour.add(s.panoramaMediaId);
    if (s.posterMediaId) thisTour.add(s.posterMediaId);
  }
  return { thisTour, anyTour };
}

export async function listPanoramasForOwnerScoped(
  ownerId: string,
  destinationId: string,
): Promise<ScopedPanoramaRow[]> {
  const [panoramas, { thisTour, anyTour }] = await Promise.all([
    listPanoramasForOwner(ownerId),
    destinationMediaSets(destinationId),
  ]);

  return panoramas.map((p) => ({
    ...p,
    inThisTour: thisTour.has(p.id),
    inAnyTour: anyTour.has(p.id) || thisTour.has(p.id),
  }));
}

export type ScopedPosterOptionRow = PosterOptionRow & {
  /** In this destination's library, or already used by a scene here. */
  inThisTour: boolean;
};

/**
 * Poster/thumbnail candidates the creator owns, tagged against one destination.
 *
 * Ownership is enforced by listPosterOptionsForOwner, which filters on ownerId.
 * A creator never sees another creator's media here, and this wrapper does not
 * widen that: it only adds a per-destination flag to rows already restricted to
 * the caller.
 */
export async function listPosterOptionsForOwnerScoped(
  ownerId: string,
  destinationId: string,
): Promise<ScopedPosterOptionRow[]> {
  const [posters, { thisTour }] = await Promise.all([
    listPosterOptionsForOwner(ownerId),
    destinationMediaSets(destinationId),
  ]);

  return posters.map((p) => ({ ...p, inThisTour: thisTour.has(p.id) }));
}

export type HeroMediaRow = {
  id: string;
  kind: "image" | "photo_360";
  cloudinaryPublicId: string | null;
  cloudinarySecureUrl: string | null;
  displayName: string | null;
  createdAt: Date;
};

export async function listHeroMediaForOwner(ownerId: string): Promise<HeroMediaRow[]> {
  const rows = await db
    .select({
      id: schema.mediaAssets.id,
      kind: schema.mediaAssets.kind,
      cloudinaryPublicId: schema.mediaAssets.cloudinaryPublicId,
      cloudinarySecureUrl: schema.mediaAssets.cloudinarySecureUrl,
      displayName: schema.mediaAssets.displayName,
      createdAt: schema.mediaAssets.createdAt,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.ownerId, ownerId),
        inArray(schema.mediaAssets.kind, ["image", "photo_360"]),
        eq(schema.mediaAssets.status, "ready"),
        isNull(schema.mediaAssets.deletedAt),
      ),
    )
    .orderBy(desc(schema.mediaAssets.createdAt));
  return rows.map((row) => ({
    ...row,
    kind: row.kind as "image" | "photo_360",
  }));
}

export type IconOptionRow = {
  id: string;
  cloudinaryPublicId: string | null;
  cloudinarySecureUrl: string | null;
  displayName: string | null;
  createdAt: Date;
};

/**
 * Candidates a creator can pick as the hotspot pin icon for a destination
 * (destinations.pin_icon_media_id). Restricted to flat `image` kind —
 * photo_360 is a 70+ MP equirectangular pano that would render as a
 * blurry smear at marker scale; screenshots live in the support folder
 * by convention and aren't intended for tour decoration.
 */
export async function listIconCandidatesForOwner(
  ownerId: string,
): Promise<IconOptionRow[]> {
  return db
    .select({
      id: schema.mediaAssets.id,
      cloudinaryPublicId: schema.mediaAssets.cloudinaryPublicId,
      cloudinarySecureUrl: schema.mediaAssets.cloudinarySecureUrl,
      displayName: schema.mediaAssets.displayName,
      createdAt: schema.mediaAssets.createdAt,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.ownerId, ownerId),
        eq(schema.mediaAssets.kind, "image"),
        eq(schema.mediaAssets.status, "ready"),
        isNull(schema.mediaAssets.deletedAt),
      ),
    )
    .orderBy(desc(schema.mediaAssets.createdAt));
}

export type PosterOptionRow = {
  id: string;
  kind: "image" | "photo_360" | "screenshot";
  cloudinaryPublicId: string | null;
  cloudinarySecureUrl: string | null;
  displayName: string | null;
  createdAt: Date;
};

/**
 * Candidates a creator can pick as a scene's 2D poster (poster_media_id).
 * Matches anything flat the viewer can render when it can't display the
 * immersive panorama — plus photo_360 so a creator can reuse the pano
 * itself as its own 2D fallback.
 */
export async function listPosterOptionsForOwner(
  ownerId: string,
): Promise<PosterOptionRow[]> {
  const rows = await db
    .select({
      id: schema.mediaAssets.id,
      kind: schema.mediaAssets.kind,
      cloudinaryPublicId: schema.mediaAssets.cloudinaryPublicId,
      cloudinarySecureUrl: schema.mediaAssets.cloudinarySecureUrl,
      displayName: schema.mediaAssets.displayName,
      createdAt: schema.mediaAssets.createdAt,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.ownerId, ownerId),
        inArray(schema.mediaAssets.kind, ["image", "photo_360", "screenshot"]),
        eq(schema.mediaAssets.status, "ready"),
        isNull(schema.mediaAssets.deletedAt),
      ),
    )
    .orderBy(desc(schema.mediaAssets.createdAt));
  return rows.map((row) => ({
    ...row,
    kind: row.kind as "image" | "photo_360" | "screenshot",
  }));
}
