ALTER TABLE "users" ADD COLUMN "allow_external_linking_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "allow_external_linking_override" boolean;--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "next_destination_id" uuid;--> statement-breakpoint
ALTER TABLE "scene_hotspots" ADD COLUMN "target_destination_id" uuid;--> statement-breakpoint
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_next_destination_id_destinations_id_fk" FOREIGN KEY ("next_destination_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_hotspots" ADD CONSTRAINT "scene_hotspots_target_destination_id_destinations_id_fk" FOREIGN KEY ("target_destination_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;