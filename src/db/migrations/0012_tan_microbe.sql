CREATE TYPE "public"."scene_status" AS ENUM('draft', 'published', 'unpublished');--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "status" "scene_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
-- Backfill: every pre-existing scene was effectively live (no status gate
-- existed when it was created), so mark all current rows 'published' to
-- preserve public tour visibility on deploy. The 'draft' default applies
-- only to scenes created from this migration onward.
UPDATE "scenes" SET "status" = 'published', "published_at" = "created_at" WHERE "status" = 'draft';--> statement-breakpoint
CREATE INDEX "scenes_status_idx" ON "scenes" USING btree ("status");