CREATE TABLE "orbe_conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"title" text NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consolidated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "orbe_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"content" text NOT NULL,
	"source" text DEFAULT 'conversa' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "orbe_conversations_scope_updated_idx" ON "orbe_conversations" USING btree ("scope","updated_at");--> statement-breakpoint
CREATE INDEX "orbe_memories_scope_idx" ON "orbe_memories" USING btree ("scope","created_at");