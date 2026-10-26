ALTER TABLE "tasks" ADD COLUMN "assignee" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "tasks_assignee_idx" ON "tasks" USING btree ("scope","assignee");