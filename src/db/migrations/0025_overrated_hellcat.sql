ALTER TABLE "destinations" ADD COLUMN "map_media_id" uuid;--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "map_template" text;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "map_x" real;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "map_y" real;--> statement-breakpoint
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_map_media_id_media_assets_id_fk" FOREIGN KEY ("map_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;
