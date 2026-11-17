import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";

it("o artefato executado no n8n classifica sem imports e mantém o vínculo do item", () => {
  const code = execFileSync(process.execPath, ["scripts/n8n/reminder-classifier.mjs"], { encoding: "utf8" });
  const input = [{ json: { status: 400, response: { message: [{ exists: false }] } } }, { json: { error: "timeout" } }];
  const result = runInNewContext(`(function(){${code}})()`, { $input: { all: () => input } });
  expect(JSON.parse(JSON.stringify(result))).toEqual([
    { json: { state: "canceled", reason: "recipient_unavailable", message_id: null, requires_alert: false }, pairedItem: { item: 0 } },
    { json: { state: "unknown", reason: "send_uncertain", message_id: null, requires_alert: true }, pairedItem: { item: 1 } },
  ]);
});
