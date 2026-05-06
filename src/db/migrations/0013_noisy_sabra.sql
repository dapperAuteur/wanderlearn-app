CREATE TABLE "destination_media_assets" (
	"destination_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"assigned_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "destination_media_assets" ADD CONSTRAINT "destination_media_assets_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_media_assets" ADD CONSTRAINT "destination_media_assets_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_media_assets" ADD CONSTRAINT "destination_media_assets_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "destination_media_pk" ON "destination_media_assets" USING btree ("destination_id","media_asset_id");--> statement-breakpoint
CREATE INDEX "destination_media_destination_idx" ON "destination_media_assets" USING btree ("destination_id");--> statement-breakpoint
CREATE INDEX "destination_media_media_idx" ON "destination_media_assets" USING btree ("media_asset_id");