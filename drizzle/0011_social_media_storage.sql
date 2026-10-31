ALTER TABLE "social_media" ALTER COLUMN "data" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "social_media" ADD COLUMN "storage" text DEFAULT 'db' NOT NULL;--> statement-breakpoint
ALTER TABLE "social_media" ADD COLUMN "path" text;