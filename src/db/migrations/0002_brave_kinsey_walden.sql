ALTER TYPE "public"."media_status" ADD VALUE 'deleted';--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "deleted_at" timestamp with time zone;