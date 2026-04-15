import { AnyPgColumn, bigint, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const mediaKind = pgEnum("media_kind", [
  "image",
  "audio",
  "standard_video",
  "photo_360",
  "video_360",
  "drone_video",
  "transcript",
  "screenshot",
  "screen_recording",
]);

export const mediaStatus = pgEnum("media_status", [
  "uploading",
  "processing",
  "ready",
  "failed",
  "deleted",
]);

export const mediaProvider = pgEnum("media_provider", ["cloudinary"]);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: mediaKind("kind").notNull(),
    status: mediaStatus("status").notNull().default("uploading"),
    provider: mediaProvider("provider").notNull().default("cloudinary"),
    displayName: text("display_name"),
    description: text("description"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    cloudinaryPublicId: text("cloudinary_public_id"),
    cloudinaryResourceType: text("cloudinary_resource_type"),
    cloudinaryFormat: text("cloudinary_format"),
    cloudinarySecureUrl: text("cloudinary_secure_url"),
    posterPublicId: text("poster_public_id"),
    durationSeconds: integer("duration_seconds"),
    width: integer("width"),
    height: integer("height"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    transcriptMediaId: uuid("transcript_media_id").references(
      (): AnyPgColumn => mediaAssets.id,
      { onDelete: "set null" },
    ),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("media_assets_owner_idx").on(table.ownerId),
    index("media_assets_status_idx").on(table.status),
    index("media_assets_kind_status_idx").on(table.kind, table.status),
  ],
);
