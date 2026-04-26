CREATE TABLE "course_destinations" (
	"course_id" uuid NOT NULL,
	"destination_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course_destinations" ADD CONSTRAINT "course_destinations_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_destinations" ADD CONSTRAINT "course_destinations_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "course_destinations_pk" ON "course_destinations" USING btree ("course_id","destination_id");--> statement-breakpoint
CREATE INDEX "course_destinations_course_idx" ON "course_destinations" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "course_destinations_destination_idx" ON "course_destinations" USING btree ("destination_id");--> statement-breakpoint
-- Partial unique index: only one row per course can have is_primary = true.
-- Lets multiple non-primary destinations coexist while still preventing a
-- course from having two "primary" rows simultaneously.
CREATE UNIQUE INDEX "course_destinations_one_primary_per_course" ON "course_destinations" USING btree ("course_id") WHERE "is_primary" = true;--> statement-breakpoint
-- Backfill from the legacy single-FK column. Every existing course that
-- has destinationId set gets one row in the join table with is_primary
-- = true. Idempotent (ON CONFLICT DO NOTHING) in case the migration is
-- re-applied or the table was partially populated.
INSERT INTO "course_destinations" ("course_id", "destination_id", "is_primary")
SELECT "id", "destination_id", true
FROM "courses"
WHERE "destination_id" IS NOT NULL
ON CONFLICT DO NOTHING;