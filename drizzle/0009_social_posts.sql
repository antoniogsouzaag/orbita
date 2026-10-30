CREATE TABLE "social_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand" text NOT NULL,
	"network" text NOT NULL,
	"format" text DEFAULT 'reels' NOT NULL,
	"stage" text DEFAULT 'ideia' NOT NULL,
	"title" text NOT NULL,
	"hook" text,
	"caption" text,
	"cta" text,
	"media_url" text,
	"reference_url" text,
	"scheduled_at" timestamp with time zone,
	"published_url" text,
	"checks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "social_posts_stage_idx" ON "social_posts" USING btree ("stage","scheduled_at");--> statement-breakpoint
CREATE INDEX "social_posts_brand_idx" ON "social_posts" USING btree ("brand","scheduled_at");