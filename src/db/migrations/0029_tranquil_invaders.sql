CREATE TABLE "hunt_hotspot_finds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hunt_id" uuid NOT NULL,
	"hotspot_id" uuid NOT NULL,
	"visitor_key" text NOT NULL,
	"granted_key" text,
	"found_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hunt_hotspot_finds" ADD CONSTRAINT "hunt_hotspot_finds_hunt_id_hunts_id_fk" FOREIGN KEY ("hunt_id") REFERENCES "public"."hunts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hunt_hotspot_finds_unique" ON "hunt_hotspot_finds" USING btree ("hunt_id","visitor_key","hotspot_id");--> statement-breakpoint
CREATE INDEX "hunt_hotspot_finds_hunt_idx" ON "hunt_hotspot_finds" USING btree ("hunt_id");--> statement-breakpoint
-- Hand-added FK. `hunt_hotspot_finds.hotspot_id` is a plain uuid in the Drizzle schema to avoid a
-- hunts -> scenes -> hotspots import cycle (same precedent as scene_hotspots.target_destination_id
-- in an earlier migration). CASCADE: if a creator deletes the hotspot, the find is meaningless, and
-- the key the visitor earned is preserved separately in the denormalized `granted_key` column.
ALTER TABLE "hunt_hotspot_finds" ADD CONSTRAINT "hunt_hotspot_finds_hotspot_id_scene_hotspots_id_fk" FOREIGN KEY ("hotspot_id") REFERENCES "public"."scene_hotspots"("id") ON DELETE cascade ON UPDATE no action;
