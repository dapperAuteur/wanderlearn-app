import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";
import { destinations } from "./destinations";

/**
 * A learner's self-declared mark on a place.
 *
 * THE ROW IS THE PLACE. One museum is one row whether it carries "want to go",
 * "been there", or both — a passport that listed it twice would read as two
 * visits, and an inflated record discredits every other number on the page.
 *
 * A place is EITHER on the app (`destinationId`) or off it (`osmId` from
 * Nominatim). Never both, never neither — enforced by a CHECK constraint
 * rather than hoped for in application code, because a row with neither is
 * unrenderable and a row with both is ambiguous about which name to show.
 *
 * WHY THE PLACE NAME AND COORDINATES ARE COPIED HERE. They are resolved once,
 * when the learner picks the place, and stored. Rendering a passport must
 * never depend on Nominatim being up — and the OSM usage policy requires us to
 * cache rather than re-query anyway.
 *
 * These marks are SELF-DECLARED and must never be mistakable for an earned
 * stamp. That is a display rule (different shape, different ink, "self" on its
 * face), but it starts here: there is deliberately no column a learner could
 * set that would make this row look derived.
 */
export const placeMarks = pgTable(
  "place_marks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /** Set when the place is a Wanderlust destination. */
    destinationId: uuid("destination_id").references(() => destinations.id, {
      onDelete: "cascade",
    }),

    /** Set when the place is off-app. OSM's stable id for it. */
    osmId: text("osm_id"),
    /** Nominatim's display name, resolved at pick time. Off-app places only. */
    placeName: text("place_name"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),

    /** A pre-state: somewhere they intend to go. */
    wantsToGo: boolean("wants_to_go").notNull().default(false),
    /** A realized state, self-declared — NOT derived from any app activity. */
    visitedInPerson: boolean("visited_in_person").notNull().default(false),
    /** Optional; plenty of people remember the place but not the date. */
    visitedOn: date("visited_on"),

    /**
     * Per-place, chosen by the learner. Private is the default: a record of
     * where someone has been is nobody else's business unless they say so,
     * and a default of public would opt people in to disclosure they never
     * asked for.
     */
    isPublic: boolean("is_public").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Exactly one of the two place kinds. A row with neither cannot be
    // rendered; a row with both cannot be named.
    check(
      "place_marks_one_place_kind",
      sql`(${table.destinationId} IS NOT NULL AND ${table.osmId} IS NULL)
       OR (${table.destinationId} IS NULL AND ${table.osmId} IS NOT NULL)`,
    ),
    // An off-app place is useless without a name to show.
    check(
      "place_marks_offapp_needs_name",
      sql`${table.osmId} IS NULL OR ${table.placeName} IS NOT NULL`,
    ),
    // One row per learner per place, per kind. Partial indexes because SQL
    // treats NULLs as distinct, so a plain unique index would happily allow
    // the same destination twice.
    uniqueIndex("place_marks_user_destination_idx")
      .on(table.userId, table.destinationId)
      .where(sql`${table.destinationId} IS NOT NULL`),
    uniqueIndex("place_marks_user_osm_idx")
      .on(table.userId, table.osmId)
      .where(sql`${table.osmId} IS NOT NULL`),
    index("place_marks_user_idx").on(table.userId),
  ],
);

/**
 * Cached Nominatim responses.
 *
 * Caching is a POLICY OBLIGATION, not an optimisation: "Results must be cached
 * on your side" (https://operations.osmfoundation.org/policies/nominatim/).
 * Keyed by the normalised query so trivial variations in case or spacing do
 * not each become an upstream request.
 */
export const placeSearchCache = pgTable("place_search_cache", {
  /** Normalised query — see cacheKeyFor() in src/lib/nominatim.ts. */
  cacheKey: text("cache_key").primaryKey(),
  /** The parsed Place[] we resolved, including the empty array. */
  results: jsonb("results").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});
