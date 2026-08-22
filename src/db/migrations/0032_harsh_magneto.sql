CREATE TABLE "place_marks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"destination_id" uuid,
	"osm_id" text,
	"place_name" text,
	"lat" double precision,
	"lng" double precision,
	"wants_to_go" boolean DEFAULT false NOT NULL,
	"visited_in_person" boolean DEFAULT false NOT NULL,
	"visited_on" date,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "place_marks_one_place_kind" CHECK (("place_marks"."destination_id" IS NOT NULL AND "place_marks"."osm_id" IS NULL)
       OR ("place_marks"."destination_id" IS NULL AND "place_marks"."osm_id" IS NOT NULL)),
	CONSTRAINT "place_marks_offapp_needs_name" CHECK ("place_marks"."osm_id" IS NULL OR "place_marks"."place_name" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "place_search_cache" (
	"cache_key" text PRIMARY KEY NOT NULL,
	"results" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "place_marks" ADD CONSTRAINT "place_marks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_marks" ADD CONSTRAINT "place_marks_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "place_marks_user_destination_idx" ON "place_marks" USING btree ("user_id","destination_id") WHERE "place_marks"."destination_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "place_marks_user_osm_idx" ON "place_marks" USING btree ("user_id","osm_id") WHERE "place_marks"."osm_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "place_marks_user_idx" ON "place_marks" USING btree ("user_id");