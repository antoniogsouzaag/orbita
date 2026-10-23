ALTER TABLE "tasks" ADD COLUMN "scope" text DEFAULT 'pessoal' NOT NULL;--> statement-breakpoint
CREATE INDEX "tasks_scope_idx" ON "tasks" USING btree ("scope","status");--> statement-breakpoint
UPDATE "tasks" SET "scope" = 'empresa' WHERE 'agente' = ANY("tags") OR "project_id" IN (SELECT "id" FROM "projects" WHERE "area" = 'empresa');
