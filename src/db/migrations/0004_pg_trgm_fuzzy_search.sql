CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_name_trgm" ON "media_assets" USING gin ("display_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_desc_trgm" ON "media_assets" USING gin ("description" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "destinations_name_trgm" ON "destinations" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scenes_name_trgm" ON "scenes" USING gin ("name" gin_trgm_ops);
