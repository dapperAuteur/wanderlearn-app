import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { sortMoments } from "@/lib/moments/moments";
import type { Moment } from "@/lib/moments/types";

/** A tour's timeline in display order. Empty for a tour without moments. */
export async function listTourMoments(destinationId: string): Promise<Moment[]> {
  const rows = await db
    .select({
      id: schema.tourMoments.id,
      label: schema.tourMoments.label,
      occurredOn: schema.tourMoments.occurredOn,
      sortOrder: schema.tourMoments.sortOrder,
      isBase: schema.tourMoments.isBase,
    })
    .from(schema.tourMoments)
    .where(eq(schema.tourMoments.destinationId, destinationId))
    .orderBy(asc(schema.tourMoments.createdAt));
  return sortMoments(rows);
}

export type SceneMomentPhotoRow = {
  momentId: string;
  mediaId: string;
  headingOffsetDeg: number;
  kind: string;
  status: string;
  publicId: string | null;
  secureUrl: string | null;
  displayName: string | null;
  metadata: unknown;
};

/** A scene's photos for its tour's moments, with enough media detail to show and load them. */
export async function listSceneMomentPhotos(sceneId: string): Promise<SceneMomentPhotoRow[]> {
  return db
    .select({
      momentId: schema.sceneMomentPanoramas.momentId,
      mediaId: schema.sceneMomentPanoramas.mediaId,
      headingOffsetDeg: schema.sceneMomentPanoramas.headingOffsetDeg,
      kind: schema.mediaAssets.kind,
      status: schema.mediaAssets.status,
      publicId: schema.mediaAssets.cloudinaryPublicId,
      secureUrl: schema.mediaAssets.cloudinarySecureUrl,
      displayName: schema.mediaAssets.displayName,
      metadata: schema.mediaAssets.metadata,
    })
    .from(schema.sceneMomentPanoramas)
    .innerJoin(schema.mediaAssets, eq(schema.mediaAssets.id, schema.sceneMomentPanoramas.mediaId))
    .where(eq(schema.sceneMomentPanoramas.sceneId, sceneId));
}
