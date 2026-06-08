ALTER TYPE "public"."content_block_type" ADD VALUE 'youtube';--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "youtube_url" text;