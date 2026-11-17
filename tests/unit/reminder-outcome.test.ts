import { describe, expect, it } from "vitest";
import { classifyReminderOutcome as classify } from "@/lib/reminder-outcome";

describe("resultado do lembrete WhatsApp", () => {
  it("exige recibo explícito para aceitação, sem afirmar entrega", () => {
    expect(classify({ success: true, data: { key: { id: "fixture" } } })).toMatchObject({ state: "accepted", requires_alert: false });
    for (const input of [{ success: true }, { success: true, data: { key: { id: " " } } }, { success: false, data: { key: { id: "fixture" } } }]) {
      expect(classify(input)).toMatchObject({ state: "unknown", requires_alert: true });
    }
  });
  it.each([
    { status: 400, response: { message: [{ exists: false, jid: "fixture" }] } },
    { error: { statusCode: 422, response: { data: { exists: false } } } },
    { error: { message: 'Provider: 400 - {"status":400,"response":{"message":[{"exists":false}]}}' } },
  ])("encerra rejeição explícita de destinatário sem alerta: %j", input => {
    const result = classify(input);
    expect(result).toEqual({ state: "canceled", reason: "recipient_unavailable", message_id: null, requires_alert: false });
    expect(JSON.stringify(result)).not.toContain("jid");
  });
  it.each([401, 403, 404, 408, 429, 500, 503])("preserva falha técnica HTTP %s", status => {
    expect(classify({ status, response: { exists: false } })).toMatchObject({ state: "unknown", requires_alert: true });
  });
  it("não confunde falha de roteamento LID com destinatário inválido", () => {
    expect(classify({ status: 400, response: { message: [{ exists: false, jid: "fixture@lid" }] } })).toMatchObject({ state: "unknown", reason: "technical_failure", requires_alert: true });
  });
  it.each([null, {}, { error: "timeout" }, { status: 400 }, { status: 400, message: "invalid number" }, { exists: false }, { status: 400, response: { exists: true } }])("mantém resultado desconhecido conservador: %j", input => {
    expect(classify(input)).toMatchObject({ state: "unknown", requires_alert: true });
  });
});
