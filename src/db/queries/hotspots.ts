import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";

export type HotspotRow = typeof schema.sceneHotspots.$inferSelect;
export type SceneLinkRow = typeof schema.sceneLinks.$inferSelect;

export async function listHotspotsForScene(sceneId: string): Promise<HotspotRow[]> {
  return db
    .select()
    .from(schema.sceneHotspots)
    .where(eq(schema.sceneHotspots.sceneId, sceneId))
    .orderBy(asc(schema.sceneHotspots.createdAt));
}

export async function getHotspotById(id: string): Promise<HotspotRow | null> {
  const rows = await db
    .select()
    .from(schema.sceneHotspots)
    .where(eq(schema.sceneHotspots.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function listLinksFromScene(sceneId: string): Promise<SceneLinkRow[]> {
  return db
    .select()
    .from(schema.sceneLinks)
    .where(eq(schema.sceneLinks.fromSceneId, sceneId))
    .orderBy(asc(schema.sceneLinks.createdAt));
}

export async function getLinkById(id: string): Promise<SceneLinkRow | null> {
  const rows = await db
    .select()
    .from(schema.sceneLinks)
    .where(eq(schema.sceneLinks.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Joins scene_hotspots -> scenes -> courses to confirm the acting user
 * owns the course (and therefore can edit the hotspot).
 */
export async function requireHotspotOwnership(
  hotspotId: string,
  userId: string,
): Promise<{ hotspot: HotspotRow; sceneId: string; destinationId: string | null } | null> {
  const rows = await db
    .select({
      hotspot: schema.sceneHotspots,
      sceneId: schema.scenes.id,
      destinationId: schema.scenes.destinationId,
      ownerId: schema.scenes.ownerId,
    })
    .from(schema.sceneHotspots)
    .innerJoin(schema.scenes, eq(schema.scenes.id, schema.sceneHotspots.sceneId))
    .where(
      and(
        eq(schema.sceneHotspots.id, hotspotId),
        eq(schema.scenes.ownerId, userId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    hotspot: row.hotspot,
    sceneId: row.sceneId,
    destinationId: row.destinationId,
  };
}

export async function requireLinkOwnership(
  linkId: string,
  userId: string,
): Promise<{ link: SceneLinkRow; fromSceneId: string; destinationId: string | null } | null> {
  const rows = await db
    .select({
      link: schema.sceneLinks,
      fromSceneId: schema.scenes.id,
      destinationId: schema.scenes.destinationId,
      ownerId: schema.scenes.ownerId,
    })
    .from(schema.sceneLinks)
    .innerJoin(schema.scenes, eq(schema.scenes.id, schema.sceneLinks.fromSceneId))
    .where(
      and(eq(schema.sceneLinks.id, linkId), eq(schema.scenes.ownerId, userId)),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    link: row.link,
    fromSceneId: row.fromSceneId,
    destinationId: row.destinationId,
  };
}
