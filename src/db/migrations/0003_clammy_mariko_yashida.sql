ALTER TABLE "media_assets" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
CREATE INDEX "media_assets_tags_gin" ON "media_assets" USING gin ("tags");