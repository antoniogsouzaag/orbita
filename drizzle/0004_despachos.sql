CREATE TABLE "dispatches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"target" text NOT NULL,
	"action" text NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"summary" text,
	"evidence" text,
	"reported_by" text,
	"run_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "dispatches_target_created_idx" ON "dispatches" USING btree ("target","created_at");