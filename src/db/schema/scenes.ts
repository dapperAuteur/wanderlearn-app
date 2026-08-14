import {
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { destinations } from "./destinations";
import { mediaAssets } from "./media";

export const sceneStatus = pgEnum("scene_status", ["draft", "published", "unpublished"]);

export const scenes = pgTable(
  "scenes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    destinationId: uuid("destination_id").references(() => destinations.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    caption: text("caption"),
    panoramaMediaId: uuid("panorama_media_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "restrict" }),
    posterMediaId: uuid("poster_media_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    startYaw: real("start_yaw"),
    startPitch: real("start_pitch"),
    // Degrees of clockwise sphere-correction roll to apply when this
    // scene mounts in the viewer. Compensates for tripod tilt at
    // capture time. Null = no correction. Clamped to ±15° at the
    // action layer; PSV converts to radians internally via the
    // `<n>deg` string form.
    rollOffsetDeg: real("roll_offset_deg"),
    // Ambient audio bed for this scene: room tone, birdsong, the sound of the
    // place. Swapped and crossfaded as the visitor walks, distinct from a
    // hotspot's audioUrl, which is a clip the visitor deliberately triggers.
    // SET NULL rather than restrict: losing the sound must never make a scene
    // unloadable.
    audioMediaId: uuid("audio_media_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    // Position on the destination's tour-map image, normalized 0..1 so the
    // placement survives image replacement at a different resolution.
    // Null = not on the map (hidden from the visitor mini-map).
    mapX: real("map_x"),
    mapY: real("map_y"),
    // REAL-WORLD position of this panorama, distinct from mapX/mapY above (which are normalized
    // coordinates on the destination's floor-plan image). Both can be set: a museum scene has a
    // place on the floor plan AND a place on Earth.
    //
    // This is what a geo-gated hunt stop measures against, and what a street-zoom map layer plots.
    // Same precision as destinations.lat/lng (numeric 9,6, roughly 0.1m) so the two are comparable.
    // Null = this scene has no known real-world position, which is the correct state for an interior
    // that was never surveyed and for any purely virtual scene.
    geoLat: numeric("geo_lat", { precision: 9, scale: 6 }),
    geoLng: numeric("geo_lng", { precision: 9, scale: 6 }),
    status: sceneStatus("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("scenes_destination_idx").on(table.destinationId),
    index("scenes_owner_idx").on(table.ownerId),
    index("scenes_status_idx").on(table.status),
  ],
);

export const sceneHotspots = pgTable(
  "scene_hotspots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sceneId: uuid("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    localKey: text("local_key").notNull(),
    yaw: real("yaw").notNull(),
    pitch: real("pitch").notNull(),
    title: text("title").notNull(),
    contentHtml: text("content_html"),
    audioMediaId: uuid("audio_media_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    externalUrl: text("external_url"),
    // Cross-tour link target. When set, this hotspot is a "go to
    // another destination" link — viewer renders a preview card with
    // the target's name + description before navigating. Mutually
    // exclusive with contentHtml + externalUrl (the action layer
    // clears them when setting this). FK without a Drizzle
    // references() to avoid a destinations ↔ scenes ↔ hotspots
    // cycle; ON DELETE SET NULL declared in the migration SQL.
    targetDestinationId: uuid("target_destination_id"),
    // ── Game mechanics: KEYS ────────────────────────────────────────────────────────────────────
    // One uniform primitive covers every mechanic parked in plans/future/12-tour-games.md, instead
    // of a separate flag per mechanic:
    //   · easter egg  — a hotspot with `requiresKeys` stays invisible until the visitor holds them
    //   · maze door   — a scene link with `requiresKeys` stays locked (see scene_links below)
    //   · clue chain  — opening a hotspot with `grantsKey` unlocks a gate somewhere else
    // Keys are short creator-chosen strings ("vault", "red-door"). They are scoped to a hunt run and
    // held client-side; nothing here identifies a visitor.
    //
    // A hotspot with no keys behaves exactly as before, so every existing tour is untouched.
    /** Opening this hotspot grants this key. Null = grants nothing. */
    grantsKey: text("grants_key"),
    /** Hidden until the visitor holds ALL of these. Null or empty = always visible. */
    requiresKeys: jsonb("requires_keys").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("scene_hotspots_scene_key_unique").on(table.sceneId, table.localKey),
    index("scene_hotspots_scene_idx").on(table.sceneId),
  ],
);

export const sceneLinks = pgTable(
  "scene_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromSceneId: uuid("from_scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    toSceneId: uuid("to_scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    name: text("name"),
    // Where the link marker sits in the FROM scene — i.e. which direction the
    // visitor walks off in.
    yaw: real("yaw"),
    pitch: real("pitch"),
    // Where the camera should be pointed on ARRIVAL in the to-scene, for visitors
    // who came along this particular link.
    //
    // Arrival heading is a property of the edge, not of the destination scene.
    // Walking lobby → gallery should leave you facing into the gallery; arriving at
    // the same gallery from the courtyard should not snap you to the same heading.
    // Modelling it on the scene (scenes.start_yaw/start_pitch) meant every route in
    // ended up facing the same way, which reads as teleporting rather than walking.
    //
    // Null falls back to the to-scene's start orientation, so existing tours behave
    // exactly as before until a creator sets this.
    arrivalYaw: real("arrival_yaw"),
    arrivalPitch: real("arrival_pitch"),
    // The maze door. When set, this link is inert until the visitor holds every listed key: the
    // arrow does not render and the edge cannot be traversed. Null or empty = an ordinary link,
    // which is what every existing row is.
    //
    // Deliberately NOT enforced server-side, because it does not need to be: a hunt is a game, not
    // an access control. Someone determined to read the page source can reach a locked scene, and
    // that is an acceptable outcome. Anything that genuinely must not be reachable belongs behind
    // the destination's own privacy controls, not behind a key.
    requiresKeys: jsonb("requires_keys").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("scene_links_from_idx").on(table.fromSceneId)],
);
