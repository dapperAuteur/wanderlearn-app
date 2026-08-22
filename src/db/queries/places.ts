import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { searchPlaces, type LookupResult, type Place } from "@/lib/nominatim";

/**
 * The database half of place lookup.
 *
 * `src/lib/nominatim.ts` owns the OSM usage policy and is pure; this supplies
 * it with a real cache and is the only place that talks to both.
 */

/**
 * How long a cached search stays fresh.
 *
 * Long, deliberately. Place names do not move, and the policy asks us to cache
 * rather than re-query — a short TTL would technically comply while defeating
 * the point. Thirty days also means a popular search costs Nominatim one
 * request a month rather than one a day.
 */
const CACHE_TTL_DAYS = 30;

async function cacheGet(key: string): Promise<Place[] | null> {
  const [row] = await db
    .select({ results: schema.placeSearchCache.results, fetchedAt: schema.placeSearchCache.fetchedAt })
    .from(schema.placeSearchCache)
    .where(eq(schema.placeSearchCache.cacheKey, key))
    .limit(1);
  if (!row) return null;
  const ageMs = Date.now() - row.fetchedAt.getTime();
  if (ageMs > CACHE_TTL_DAYS * 24 * 60 * 60 * 1000) return null;
  return row.results as Place[];
}

async function cacheSet(key: string, places: Place[]): Promise<void> {
  await db
    .insert(schema.placeSearchCache)
    .values({ cacheKey: key, results: places, fetchedAt: new Date() })
    // A concurrent search for the same term must refresh rather than throw.
    .onConflictDoUpdate({
      target: schema.placeSearchCache.cacheKey,
      set: { results: places, fetchedAt: new Date() },
    });
}

export function lookupPlaces(query: string): Promise<LookupResult> {
  return searchPlaces(query, { now: Date.now, fetchImpl: fetch, cacheGet, cacheSet });
}

export type PlaceMarkRow = typeof schema.placeMarks.$inferSelect;

export async function listMarksForUser(userId: string): Promise<PlaceMarkRow[]> {
  return db.select().from(schema.placeMarks).where(eq(schema.placeMarks.userId, userId));
}

/** Only the marks a learner has chosen to show. Used by any shared view. */
export async function listPublicMarksForUser(userId: string): Promise<PlaceMarkRow[]> {
  return db
    .select()
    .from(schema.placeMarks)
    .where(and(eq(schema.placeMarks.userId, userId), eq(schema.placeMarks.isPublic, true)));
}

export type UpsertMarkInput = {
  userId: string;
  wantsToGo: boolean;
  visitedInPerson: boolean;
  visitedOn: string | null;
  isPublic: boolean;
} & ({ destinationId: string; osmId?: never } | { osmId: string; place: Place });

/**
 * Create or update one learner's mark on one place.
 *
 * Upsert rather than insert: marking a place you already marked is an edit,
 * not a duplicate, and the partial unique indexes would reject the insert
 * anyway. Which index applies depends on the place kind, so the two branches
 * cannot be collapsed.
 */
export async function upsertPlaceMark(input: UpsertMarkInput): Promise<void> {
  const common = {
    userId: input.userId,
    wantsToGo: input.wantsToGo,
    visitedInPerson: input.visitedInPerson,
    visitedOn: input.visitedOn,
    isPublic: input.isPublic,
    updatedAt: new Date(),
  };

  if ("destinationId" in input && input.destinationId) {
    await db
      .insert(schema.placeMarks)
      .values({ ...common, destinationId: input.destinationId })
      .onConflictDoUpdate({
        target: [schema.placeMarks.userId, schema.placeMarks.destinationId],
        targetWhere: sql`${schema.placeMarks.destinationId} IS NOT NULL`,
        set: common,
      });
    return;
  }

  if ("osmId" in input && input.osmId) {
    await db
      .insert(schema.placeMarks)
      .values({
        ...common,
        osmId: input.osmId,
        // Copied at pick time so rendering never re-queries Nominatim.
        placeName: input.place.displayName,
        lat: input.place.lat,
        lng: input.place.lng,
      })
      .onConflictDoUpdate({
        target: [schema.placeMarks.userId, schema.placeMarks.osmId],
        targetWhere: sql`${schema.placeMarks.osmId} IS NOT NULL`,
        set: { ...common, placeName: input.place.displayName },
      });
    return;
  }

  // Unreachable through the type, but a runtime guard is cheap and the CHECK
  // constraint's error message would be far less clear.
  throw new Error("A place mark needs either a destinationId or an osmId.");
}

export async function deletePlaceMark(userId: string, markId: string): Promise<void> {
  // Scoped by userId as well as id: an id alone would let anyone delete
  // anyone's mark by guessing a uuid.
  await db
    .delete(schema.placeMarks)
    .where(and(eq(schema.placeMarks.id, markId), eq(schema.placeMarks.userId, userId)));
}
