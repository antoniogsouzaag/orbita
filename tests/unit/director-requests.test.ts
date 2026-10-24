import { describe, expect, it } from "vitest";
import { directorRequests, safeEvidenceUrl } from "@/lib/director-requests";
import type { DispatchView } from "@/server/dispatch";
import type { HermesOperation } from "@/server/hermes";

const oracle = (status: HermesOperation["status"]): HermesOperation => ({ id: "same-id", status, action: "reminder.internal", detail: "Estado do receptor", createdAt: "2026-10-24T12:00:00Z", checkedAt: "2026-10-24T13:00:00Z" });
const tom = (status: DispatchView["status"], silent = false): DispatchView => ({
  id: "same-id", target: "openclaw", action: "request.tom", status,
  params: { texto: "Analisar operação" }, detail: "Estado do gateway", summary: "Evidência recebida",
  evidence: "https://example.com/prova", runId: null, reportedBy: "Tom", silent,
  createdAt: new Date("2026-10-24T11:00:00Z"), updatedAt: new Date("2026-10-24T13:00:00Z"), finishedAt: null,
});

describe("acompanhamento da diretoria", () => {
  it("não trata admissão como conclusão nem mistura identificadores entre receptores", () => {
    const rows = directorRequests([tom("accepted")], [oracle("completed")]);
    expect(rows.map(row => row.agent)).toEqual(["Oracle", "Tom"]);
    expect(new Set(rows.map(row => row.key)).size).toBe(2);
    expect(rows[0].group).toBe("completed");
    expect(rows[1].group).toBe("open");
    expect(rows[1].detail).toBe("Evidência recebida");
  });
  it("destaca incerteza, falha e silêncio sem inventar conclusão", () => {
    for (const status of ["unknown", "failed", "rejected"] as const) expect(directorRequests([tom(status)], [])[0].group).toBe("attention");
    expect(directorRequests([tom("running", true)], [])[0]).toMatchObject({ group: "attention", status: "Em execução", silent: true });
    for (const status of ["unknown", "interrupted", "due", "failed"] as const) expect(directorRequests([], [oracle(status)])[0].group).toBe("attention");
    expect(directorRequests([], [oracle("scheduled")])[0].group).toBe("open");
  });
  it("preserva datas e evidência e aceita amostra vazia", () => {
    expect(directorRequests([], [])).toEqual([]);
    expect(directorRequests([tom("completed")], [])[0]).toMatchObject({ evidence: "https://example.com/prova", updatedAt: "2026-10-24T13:00:00.000Z" });
  });
  it("só torna evidências HTTPS sem credenciais clicáveis", () => {
    expect(safeEvidenceUrl("https://example.com/prova")).toBe("https://example.com/prova");
    for (const value of ["javascript:alert(1)", "http://example.com", "https://secret@example.com", "comando registrado"]) expect(safeEvidenceUrl(value)).toBeNull();
  });
});
