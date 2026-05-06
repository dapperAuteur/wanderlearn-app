import { sql } from "drizzle-orm";
import { AnyPgColumn, bigint, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { destinations } from "./destinations";

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
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
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
    // Set when an admin transfers ownership of this media (via the
    // destination-transfer action). Lets the destination media library
    // surface "media you once owned and transferred away" to that admin
    // even after ownerId moved to the new owner. NULL means either
    // never transferred, or the original owner wasn't an admin (we
    // only track admin-origin transfers because that's the only case
    // where the original owner retains an in-app library view per the
    // spec). Set NULL on delete-cascade-ish behavior so a deleted
    // admin's row doesn't break the FK.
    originalAdminOwnerId: text("original_admin_owner_id").references(
      () => users.id,
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
    index("media_assets_tags_gin").using("gin", table.tags),
  ],
);

// Many-to-many between destinations and media. Lets a creator declare
// "this drone shot is part of Mexico City's library" so courses/tours
// linked to that destination can find the media in one place. The
// query layer (src/db/queries/media.ts:listMediaForDestination) also
// auto-includes media that's already FK-referenced from the owner's
// scenes at the destination, so creators don't have to dual-bookkeep
// panoramas they've already wired up.
export const destinationMediaAssets = pgTable(
  "destination_media_assets",
  {
    destinationId: uuid("destination_id")
      .notNull()
      .references(() => destinations.id, { onDelete: "cascade" }),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    // Who clicked "assign". Restricted on delete so we don't lose the
    // audit trail if the assigning user's account is later removed.
    assignedBy: text("assigned_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("destination_media_pk").on(table.destinationId, table.mediaAssetId),
    index("destination_media_destination_idx").on(table.destinationId),
    index("destination_media_media_idx").on(table.mediaAssetId),
  ],
);
