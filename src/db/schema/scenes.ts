import { index, pgEnum, pgTable, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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
    yaw: real("yaw"),
    pitch: real("pitch"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("scene_links_from_idx").on(table.fromSceneId)],
);
