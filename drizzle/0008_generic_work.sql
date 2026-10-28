ALTER TABLE dispatches ADD COLUMN origin jsonb;
--> statement-breakpoint
ALTER TABLE dispatches ADD COLUMN request_key text;
--> statement-breakpoint
CREATE UNIQUE INDEX dispatches_generic_request_key ON dispatches(request_key) WHERE action = 'task.dispatch' AND target = 'hermes';
--> statement-breakpoint
CREATE UNIQUE INDEX dispatches_generic_active_task ON dispatches((params->>'task_id')) WHERE action = 'task.dispatch' AND target = 'hermes' AND status IN ('sending','accepted','running','unknown');
--> statement-breakpoint
