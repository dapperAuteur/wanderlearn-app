CREATE TYPE "public"."hunt_mode" AS ENUM('virtual', 'onsite');--> statement-breakpoint
CREATE TYPE "public"."hunt_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."hunt_unlock_kind" AS ENUM('open', 'answer', 'keys', 'geo');--> statement-breakpoint
CREATE TABLE "hunt_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hunt_id" uuid NOT NULL,
	"stop_id" uuid NOT NULL,
	"visitor_key" text NOT NULL,
	"via_fallback" boolean DEFAULT false NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hunt_stops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hunt_id" uuid NOT NULL,
	"scene_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"title" text NOT NULL,
	"clue" text,
	"reveal" text,
	"unlock_kind" "hunt_unlock_kind" DEFAULT 'open' NOT NULL,
	"answers" jsonb,
	"required_keys" jsonb,
	"grants_key" text,
	"unlock_radius_m" integer DEFAULT 40 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hunts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"destination_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"intro" text,
	"mode" "hunt_mode" DEFAULT 'virtual' NOT NULL,
	"status" "hunt_status" DEFAULT 'draft' NOT NULL,
	"allow_remote_fallback" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scene_hotspots" ADD COLUMN "grants_key" text;--> statement-breakpoint
ALTER TABLE "scene_hotspots" ADD COLUMN "requires_keys" jsonb;--> statement-breakpoint
ALTER TABLE "scene_links" ADD COLUMN "requires_keys" jsonb;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "geo_lat" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "geo_lng" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "hunt_progress" ADD CONSTRAINT "hunt_progress_hunt_id_hunts_id_fk" FOREIGN KEY ("hunt_id") REFERENCES "public"."hunts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hunt_progress" ADD CONSTRAINT "hunt_progress_stop_id_hunt_stops_id_fk" FOREIGN KEY ("stop_id") REFERENCES "public"."hunt_stops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hunt_stops" ADD CONSTRAINT "hunt_stops_hunt_id_hunts_id_fk" FOREIGN KEY ("hunt_id") REFERENCES "public"."hunts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hunt_stops" ADD CONSTRAINT "hunt_stops_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hunts" ADD CONSTRAINT "hunts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hunts" ADD CONSTRAINT "hunts_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hunt_progress_unique" ON "hunt_progress" USING btree ("hunt_id","visitor_key","stop_id");--> statement-breakpoint
CREATE INDEX "hunt_progress_hunt_idx" ON "hunt_progress" USING btree ("hunt_id");--> statement-breakpoint
CREATE INDEX "hunt_stops_hunt_idx" ON "hunt_stops" USING btree ("hunt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hunt_stops_hunt_order_unique" ON "hunt_stops" USING btree ("hunt_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "hunts_destination_slug_unique" ON "hunts" USING btree ("destination_id","slug");--> statement-breakpoint
CREATE INDEX "hunts_destination_idx" ON "hunts" USING btree ("destination_id");--> statement-breakpoint
CREATE INDEX "hunts_owner_idx" ON "hunts" USING btree ("owner_id");