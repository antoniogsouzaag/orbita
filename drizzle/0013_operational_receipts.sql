-- Preserve legacy events; deduplicate new source execution receipts atomically.
ALTER TABLE "ops_events" ADD COLUMN "receipt_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "ops_events_receipt_key_idx" ON "ops_events" USING btree ("receipt_key");
