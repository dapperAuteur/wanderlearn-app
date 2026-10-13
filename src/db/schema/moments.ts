import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { destinations } from "./destinations";
import { mediaAssets } from "./media";
import { scenes } from "./scenes";

/**
 * Moments: one place seen at different times ("1998", "Opening day", "Finish").
 * plans/15-scene-moments-over-time.md.
 *
 * The timeline belongs to the TOUR, so "1998" means the same thing in every
 * room, which is what lets the time stay put when a visitor follows an arrow.
 *
 * The base view is a real row (`is_base`, label "Now" by default), created with
 * the tour's first moment. Its panorama in each scene is the scene's own
 * `panorama_media_id`, so it never has a scene_moment_panoramas row. Being a
 * row is what lets a hotspot be limited to "only now" like any other moment.
 * A tour with no rows behaves exactly as before moments existed.
 */
export const tourMoments = pgTable(
  "tour_moments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    destinationId: uuid("destination_id")
      .notNull()
      .references(() => destinations.id, { onDelete: "cascade" }),
    /** Free text the switcher shows. Validated to 1–40 characters. */
    label: text("label").notNull(),
    /** Optional; used for sorting only. Plenty of moments are events, not dates. */
    occurredOn: date("occurred_on"),
    /** The creator's order. Ties fall back to occurred_on, then created_at. */
    sortOrder: integer("sort_order").notNull().default(0),
    isBase: boolean("is_base").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("tour_moments_destination_idx").on(table.destinationId),
    uniqueIndex("tour_moments_one_base_per_destination")
      .on(table.destinationId)
      .where(sql`${table.isBase}`),
  ],
);

/**
 * A scene's panorama for one (non-base) moment. Optional per scene: a room
 * with no 1998 photo simply has no row, and the viewer falls back to its base
 * view with a notice.
 */
export const sceneMomentPanoramas = pgTable(
  "scene_moment_panoramas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sceneId: uuid("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    momentId: uuid("moment_id")
      .notNull()
      .references(() => tourMoments.id, { onDelete: "cascade" }),
    // Restrict, like every other media use: the media library's reference
    // blocker refuses to delete a file a moment still shows.
    mediaId: uuid("media_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "restrict" }),
    /**
     * Degrees (−180..180) the photo is turned so it lines up with the base
     * view. A re-shoot rarely faces exactly the same way; with this, every
     * hotspot and arrow placed on the base view lands on the same feature.
     */
    headingOffsetDeg: real("heading_offset_deg").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("scene_moment_panoramas_scene_moment_unique").on(table.sceneId, table.momentId),
    index("scene_moment_panoramas_moment_idx").on(table.momentId),
    index("scene_moment_panoramas_media_idx").on(table.mediaId),
  ],
);
