CREATE TABLE "ops_domains" (
	"domain" text PRIMARY KEY NOT NULL,
	"depends" text,
	"expires_at" timestamp with time zone,
	"error" text,
	"source" text NOT NULL,
	"checked_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"source" text NOT NULL,
	"subject" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ops_heartbeats" (
	"source" text PRIMARY KEY NOT NULL,
	"label" text,
	"last_seen" timestamp with time zone NOT NULL,
	"every_minutes" integer DEFAULT 15 NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_status" (
	"url" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"group" text,
	"ok" boolean NOT NULL,
	"status_code" integer,
	"error" text,
	"latency_ms" integer,
	"fails" integer DEFAULT 0 NOT NULL,
	"source" text NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"changed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ops_events_created_idx" ON "ops_events" USING btree ("created_at");