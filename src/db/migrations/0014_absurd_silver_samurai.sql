ALTER TYPE "public"."user_role" ADD VALUE 'site_manager';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "permissions" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "permissions_granted_by" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "permissions_granted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_permissions_granted_by_users_id_fk" FOREIGN KEY ("permissions_granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;