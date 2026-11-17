import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const query = readFileSync("scripts/n8n/reminder-result.sql", "utf8");
beforeAll(async () => {
  await db.exec(`CREATE SCHEMA barberias_whatsapp;
    CREATE TABLE barberias_whatsapp.reminder_queue (id bigint PRIMARY KEY, state text CHECK (state IN ('processing','accepted','unknown','canceled')), claimed_by text, provider_message_id text, accepted_at timestamptz, detail text, updated_at timestamptz);
    CREATE TABLE barberias_whatsapp.sender_lock (singleton boolean PRIMARY KEY, owner text, locked_until timestamptz, next_send_at timestamptz);`);
});
afterAll(async () => { await db.close(); });
it.each([
  ["accepted", "provider_accepted", "fixture", "accepted", false],
  ["accepted", "provider_accepted", null, "unknown", true],
  ["canceled", "recipient_unavailable", null, "canceled", false],
  ["canceled", "technical_failure", null, "unknown", true],
  ["unknown", "send_uncertain", null, "unknown", true],
])("registra %s/%s de forma terminal e libera somente a trava do dono", async (state, reason, messageId, expectedState, requiresAlert) => {
  await db.exec(`TRUNCATE barberias_whatsapp.reminder_queue, barberias_whatsapp.sender_lock;
    INSERT INTO barberias_whatsapp.reminder_queue (id,state,claimed_by) VALUES (1,'processing','fixture');
    INSERT INTO barberias_whatsapp.sender_lock VALUES (true,'fixture',now()+interval '1 minute',now());`);
  const result = await db.query(query, ["1", "fixture", state, reason, messageId]);
  expect(result.rows[0]).toMatchObject({ queue_id: "1", execution_id: "fixture", recorded: true, requires_alert: requiresAlert });
  const saved = (await db.query<{ state: string; provider_message_id: string | null }>("SELECT * FROM barberias_whatsapp.reminder_queue")).rows[0];
  expect(saved.state).toBe(expectedState);
  expect(saved.provider_message_id).toBe(expectedState === "accepted" ? messageId : null);
  expect((await db.query("SELECT owner FROM barberias_whatsapp.sender_lock")).rows[0]).toEqual({ owner: null });
  expect((await db.query(query, ["1", "fixture", state, reason, messageId])).rows[0]).toMatchObject({ queue_id: null, recorded: false, requires_alert: true });
});
