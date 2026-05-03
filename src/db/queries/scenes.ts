import { and, desc, eq, inArray, isNull } from "drizzle-orm";
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
