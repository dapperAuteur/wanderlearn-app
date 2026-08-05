import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { HuntStopInput } from "@/lib/hunts";

export type HuntRow = typeof schema.hunts.$inferSelect;
export type HuntStopRow = typeof schema.huntStops.$inferSelect;

/** A stop joined to the bits of its scene the runtime and the health check need. */
export type HuntStopWithScene = HuntStopRow & {
  sceneName: string;
  sceneGeoLat: string | null;
  sceneGeoLng: string | null;
};

export async function listHuntsForDestination(destinationId: string): Promise<HuntRow[]> {
  return db
    .select()
    .from(schema.hunts)
    .where(eq(schema.hunts.destinationId, destinationId))
    .orderBy(asc(schema.hunts.createdAt));
}

export async function getHuntById(id: string): Promise<HuntRow | null> {
  const rows = await db.select().from(schema.hunts).where(eq(schema.hunts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getHuntBySlug(destinationId: string, slug: string): Promise<HuntRow | null> {
  const rows = await db
    .select()
    .from(schema.hunts)
    .where(and(eq(schema.hunts.destinationId, destinationId), eq(schema.hunts.slug, slug)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listStopsForHunt(huntId: string): Promise<HuntStopWithScene[]> {
  const rows = await db
    .select({
      stop: schema.huntStops,
      sceneName: schema.scenes.name,
      sceneGeoLat: schema.scenes.geoLat,
      sceneGeoLng: schema.scenes.geoLng,
    })
    .from(schema.huntStops)
    .innerJoin(schema.scenes, eq(schema.huntStops.sceneId, schema.scenes.id))
    .where(eq(schema.huntStops.huntId, huntId))
    .orderBy(asc(schema.huntStops.sortOrder));

  return rows.map((r) => ({
    ...r.stop,
    sceneName: r.sceneName,
    sceneGeoLat: r.sceneGeoLat,
    sceneGeoLng: r.sceneGeoLng,
  }));
}

/**
 * Every key any hotspot in this destination can grant.
 *
 * The health check needs this to tell "the visitor can never get this key" apart from "the key comes
 * from a hidden hotspot rather than from a stop". Without it, every hotspot-granted key would be
 * reported as unobtainable and the check would cry wolf until a creator learned to ignore it.
 */
export async function listHotspotKeysForDestination(destinationId: string): Promise<string[]> {
  const sceneIds = await db
    .select({ id: schema.scenes.id })
    .from(schema.scenes)
    .where(eq(schema.scenes.destinationId, destinationId));
  if (sceneIds.length === 0) return [];

  const rows = await db
    .select({ grantsKey: schema.sceneHotspots.grantsKey })
    .from(schema.sceneHotspots)
    .where(
      inArray(
        schema.sceneHotspots.sceneId,
        sceneIds.map((s) => s.id),
      ),
    );
  return [...new Set(rows.map((r) => r.grantsKey).filter((k): k is string => !!k))];
}

/** Stops shaped for the pure logic in src/lib/hunts.ts, with numeric coords parsed once. */
export function toStopInputs(stops: HuntStopWithScene[]): (HuntStopInput & { sceneId: string })[] {
  return stops.map((s) => ({
    id: s.id,
    sceneId: s.sceneId,
    sortOrder: s.sortOrder,
    title: s.title,
    unlockKind: s.unlockKind,
    answers: s.answers,
    requiredKeys: s.requiredKeys,
    grantsKey: s.grantsKey,
    unlockRadiusM: s.unlockRadiusM,
    // numeric(9,6) comes back as a string from pg; parse once here so no caller has to remember.
    geoLat: s.sceneGeoLat == null ? null : Number(s.sceneGeoLat),
    geoLng: s.sceneGeoLng == null ? null : Number(s.sceneGeoLng),
  }));
}

/** Stop ids this visitor has already unlocked. */
export async function listProgress(huntId: string, visitorKey: string): Promise<string[]> {
  const rows = await db
    .select({ stopId: schema.huntProgress.stopId })
    .from(schema.huntProgress)
    .where(
      and(eq(schema.huntProgress.huntId, huntId), eq(schema.huntProgress.visitorKey, visitorKey)),
    );
  return rows.map((r) => r.stopId);
}
