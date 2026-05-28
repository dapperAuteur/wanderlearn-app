ALTER TABLE "destinations" ADD COLUMN "profile_media_id" uuid;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "profile_media_id" uuid;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_profile_media_id_media_assets_id_fk" FOREIGN KEY ("profile_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;