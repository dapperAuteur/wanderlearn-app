ALTER TABLE "destinations" ADD COLUMN "transition_audio_media_id" uuid;--> statement-breakpoint
ALTER TABLE "scene_links" ADD COLUMN "transition_audio_media_id" uuid;--> statement-breakpoint
ALTER TABLE "scene_links" ADD COLUMN "transition_audio_silent" boolean DEFAULT false NOT NULL;