ALTER TABLE "scene_hotspots" ADD COLUMN "media_id" uuid;--> statement-breakpoint
ALTER TABLE "scene_hotspots" ADD COLUMN "media_alt" text;--> statement-breakpoint
ALTER TABLE "scene_hotspots" ADD COLUMN "youtube_video_id" text;--> statement-breakpoint
ALTER TABLE "scene_hotspots" ADD CONSTRAINT "scene_hotspots_media_id_media_assets_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;