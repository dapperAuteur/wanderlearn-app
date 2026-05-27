ALTER TYPE "public"."support_thread_status" ADD VALUE 'resolved_pending_confirm' BEFORE 'closed';--> statement-breakpoint
ALTER TYPE "public"."support_thread_status" ADD VALUE 'resolved_user_confirmed' BEFORE 'closed';--> statement-breakpoint
ALTER TYPE "public"."support_thread_status" ADD VALUE 'resolved_user_disputed' BEFORE 'closed';--> statement-breakpoint
ALTER TABLE "support_threads" ADD COLUMN "user_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_threads" ADD COLUMN "user_confirmed_positive" boolean;--> statement-breakpoint
ALTER TABLE "support_threads" ADD COLUMN "user_dispute_reason" text;--> statement-breakpoint
ALTER TABLE "support_threads" ADD COLUMN "retro_prompted_at" timestamp with time zone;