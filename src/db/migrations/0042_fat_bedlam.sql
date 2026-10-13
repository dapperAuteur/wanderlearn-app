CREATE TABLE "scene_moment_panoramas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scene_id" uuid NOT NULL,
	"moment_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"heading_offset_deg" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tour_moments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"destination_id" uuid NOT NULL,
	"label" text NOT NULL,
	"occurred_on" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_base" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "offline_include_moments" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "scene_hotspots" ADD COLUMN "moment_id" uuid;--> statement-breakpoint
ALTER TABLE "scene_moment_panoramas" ADD CONSTRAINT "scene_moment_panoramas_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_moment_panoramas" ADD CONSTRAINT "scene_moment_panoramas_moment_id_tour_moments_id_fk" FOREIGN KEY ("moment_id") REFERENCES "public"."tour_moments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_moment_panoramas" ADD CONSTRAINT "scene_moment_panoramas_media_id_media_assets_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_moments" ADD CONSTRAINT "tour_moments_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scene_moment_panoramas_scene_moment_unique" ON "scene_moment_panoramas" USING btree ("scene_id","moment_id");--> statement-breakpoint
CREATE INDEX "scene_moment_panoramas_moment_idx" ON "scene_moment_panoramas" USING btree ("moment_id");--> statement-breakpoint
CREATE INDEX "scene_moment_panoramas_media_idx" ON "scene_moment_panoramas" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "tour_moments_destination_idx" ON "tour_moments" USING btree ("destination_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tour_moments_one_base_per_destination" ON "tour_moments" USING btree ("destination_id") WHERE "tour_moments"."is_base";--> statement-breakpoint
ALTER TABLE "scene_hotspots" ADD CONSTRAINT "scene_hotspots_moment_id_tour_moments_id_fk" FOREIGN KEY ("moment_id") REFERENCES "public"."tour_moments"("id") ON DELETE set null ON UPDATE no action;