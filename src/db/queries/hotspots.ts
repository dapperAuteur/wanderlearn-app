import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
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
 * Loads a hotspot with the parent scene's owner so the caller can
 * decide whether to allow the action (creator-owns or site_manager-bypass).
 * Authorization is intentionally NOT done here; callers run
 * canManageOrOwn(user, sceneOwnerId, "hotspots", action) themselves.
 */
export async function getHotspotWithSceneContext(
  hotspotId: string,
): Promise<
  | {
      hotspot: HotspotRow;
      sceneId: string;
      sceneOwnerId: string;
      destinationId: string | null;
    }
  | null
> {
  const rows = await db
    .select({
      hotspot: schema.sceneHotspots,
      sceneId: schema.scenes.id,
      sceneOwnerId: schema.scenes.ownerId,
      destinationId: schema.scenes.destinationId,
    })
    .from(schema.sceneHotspots)
    .innerJoin(schema.scenes, eq(schema.scenes.id, schema.sceneHotspots.sceneId))
    .where(eq(schema.sceneHotspots.id, hotspotId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    hotspot: row.hotspot,
    sceneId: row.sceneId,
    sceneOwnerId: row.sceneOwnerId,
    destinationId: row.destinationId,
  };
}

export async function getLinkWithSceneContext(
  linkId: string,
): Promise<
  | {
      link: SceneLinkRow;
      fromSceneId: string;
      sceneOwnerId: string;
      destinationId: string | null;
    }
  | null
> {
  const rows = await db
    .select({
      link: schema.sceneLinks,
      fromSceneId: schema.scenes.id,
      sceneOwnerId: schema.scenes.ownerId,
      destinationId: schema.scenes.destinationId,
    })
    .from(schema.sceneLinks)
    .innerJoin(schema.scenes, eq(schema.scenes.id, schema.sceneLinks.fromSceneId))
    .where(eq(schema.sceneLinks.id, linkId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    link: row.link,
    fromSceneId: row.fromSceneId,
    sceneOwnerId: row.sceneOwnerId,
    destinationId: row.destinationId,
  };
}

export type DestinationLinkRow = {
  linkId: string;
  fromSceneId: string;
  fromSceneName: string;
  toSceneId: string;
  toSceneName: string;
  name: string | null;
  yaw: number | null;
  pitch: number | null;
  arrivalYaw: number | null;
  arrivalPitch: number | null;
  createdAt: Date;
};

/**
 * Every scene link at a destination, with both endpoint names.
 *
 * The connections page needs the whole graph at once — per-scene queries
 * (listLinksFromScene) would be N round trips and still not answer "who links
 * INTO this room". Filtered on the FROM scene's destination: links pointing at
 * another destination's scene still appear (they leave from here), which is
 * what a creator auditing this tour wants to see.
 */
export async function listLinksForDestination(
  destinationId: string,
): Promise<DestinationLinkRow[]> {
  const fromScenes = alias(schema.scenes, "from_scenes");
  const toScenes = alias(schema.scenes, "to_scenes");
  return db
    .select({
      linkId: schema.sceneLinks.id,
      fromSceneId: schema.sceneLinks.fromSceneId,
      fromSceneName: fromScenes.name,
      toSceneId: schema.sceneLinks.toSceneId,
      toSceneName: toScenes.name,
      name: schema.sceneLinks.name,
      yaw: schema.sceneLinks.yaw,
      pitch: schema.sceneLinks.pitch,
      arrivalYaw: schema.sceneLinks.arrivalYaw,
      arrivalPitch: schema.sceneLinks.arrivalPitch,
      createdAt: schema.sceneLinks.createdAt,
    })
    .from(schema.sceneLinks)
    .innerJoin(fromScenes, eq(fromScenes.id, schema.sceneLinks.fromSceneId))
    .innerJoin(toScenes, eq(toScenes.id, schema.sceneLinks.toSceneId))
    .where(eq(fromScenes.destinationId, destinationId))
    .orderBy(fromScenes.name, toScenes.name, schema.sceneLinks.createdAt);
}
