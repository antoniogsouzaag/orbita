import { describe, expect, it } from "vitest";
import { classifyOpsEvents, opsEventSummary } from "@/lib/ops-events";

const now = Date.parse("2026-10-28T12:00:00Z");
const event = (kind: string, severity: string, ageHours = 0, resolved = false) => ({ kind, severity, subject: `${kind}-${ageHours}`, createdAt: new Date(now - ageHours * 3_600_000), resolvedAt: resolved ? new Date(now) : null });

describe("classificação da amostra operacional", () => {
  it("separa quedas, falhas e relatos de agentes, respeitando resolução e janela", () => {
    const events = [event("site_down", "critical", 72), event("site_down", "critical", 1, true), event("workflow_error", "warning", 1), event("workflow_error", "warning", 48), event("workflow_error", "warning", 2, true), event("agente_alerta", "warning", 1), event("agente_incidente", "critical", 3), event("agente_resumo", "info", 1), event("domain_alert", "warning", 2, true), event("workflow_error", "warning", -1)];
    const result = classifyOpsEvents(events, now);
    expect(result.siteIncidents).toHaveLength(1);
    expect(result.pendingWorkflows).toHaveLength(3);
    expect(result.recentWorkflows).toHaveLength(2);
    expect(result.otherAlerts.map((item) => item.kind)).toEqual(["agente_alerta", "agente_incidente"]);
    const summary = opsEventSummary(events, now).join("\n");
    expect(summary).toContain("Amostra: até 80 eventos");
    expect(summary).toContain("Quedas de sites não resolvidas na amostra: 1");
    expect(summary).toContain("2 nas últimas 24h; 3 sem resolução registrada");
    expect(summary).toContain("Outros alertas ou relatos de agentes não resolvidos na amostra: 2");
  });

  it("descreve zero como resultado da amostra, nunca como cobertura completa", () => {
    expect(opsEventSummary([], now).join("\n")).toContain("não representa o histórico completo");
    expect(opsEventSummary([], now).join("\n")).toContain("na amostra: 0");
  });
});
