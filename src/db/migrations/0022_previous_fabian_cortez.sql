CREATE TYPE "public"."tour_type" AS ENUM('course', 'tour_only', 'concert', 'hike', 'bike_ride', 'museum', 'real_estate');--> statement-breakpoint
CREATE TABLE "tour_type_settings" (
	"type" "tour_type" PRIMARY KEY NOT NULL,
	"color" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "tour_type" "tour_type";--> statement-breakpoint
-- Seed admin-managed presentation for each tour type (hand-added; mirrors
-- TOUR_TYPE_DEFAULT_COLORS/ORDER in src/lib/tour-types.ts). Idempotent so
-- re-running the migration is safe.
INSERT INTO "tour_type_settings" ("type", "color", "sort_order") VALUES
	('course', '#0ea5e9', 0),
	('tour_only', '#64748b', 1),
	('concert', '#e11d48', 2),
	('hike', '#10b981', 3),
	('bike_ride', '#14b8a6', 4),
	('museum', '#8b5cf6', 5),
	('real_estate', '#f59e0b', 6)
ON CONFLICT ("type") DO NOTHING;