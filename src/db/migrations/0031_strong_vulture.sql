ALTER TABLE "destinations" ADD COLUMN "peak_scene_id" uuid;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "order_index" integer;--> statement-breakpoint
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_peak_scene_id_scenes_id_fk" FOREIGN KEY ("peak_scene_id") REFERENCES "public"."scenes"("id") ON DELETE set null ON UPDATE no action;