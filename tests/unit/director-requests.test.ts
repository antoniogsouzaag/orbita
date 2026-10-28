import { describe, expect, it } from "vitest";
import { directorRequests, safeEvidenceUrl } from "@/lib/director-requests";
import type { DispatchView } from "@/server/dispatch";
import type { HermesOperation } from "@/server/hermes";

const oracle = (status: HermesOperation["status"]): HermesOperation => ({ id: "same-id", status, action: "reminder.internal", detail: "Estado do receptor", createdAt: "2026-10-24T12:00:00Z", checkedAt: "2026-10-24T13:00:00Z" });
const tom = (status: DispatchView["status"], silent = false): DispatchView => ({
  origin: null, requestKey: null, id: "same-id", target: "openclaw", action: "request.tom", status,
  params: { texto: "Analisar operação" }, detail: "Estado do gateway", summary: "Evidência recebida",
  evidence: "https://example.com/prova", runId: null, reportedBy: "Tom", silent,
  createdAt: new Date("2026-10-24T11:00:00Z"), updatedAt: new Date("2026-10-24T13:00:00Z"), finishedAt: null,
});

describe("acompanhamento da diretoria", () => {
 it("trabalho genérico só conclui com prova validada",()=>{
  const task:HermesOperation={...oracle("completed"),action:"task.dispatch",taskId:"12345678-1234-4234-8234-123456789abc",taskExecution:true,verified:true,sessionId:"session-123",evidence:["Native receipt"],responseText:"Teste executado"};
  expect(directorRequests([],[task])[0]).toMatchObject({group:"completed",detail:"Teste executado"});
  for(const invalid of [{verified:undefined},{taskExecution:undefined},{taskId:undefined}]) expect(directorRequests([],[{...task,...invalid}])[0]).toMatchObject({group:"attention",status:"Conclusão não verificada"});
 });
 it("só conclui manutenção com marcadores verificados e tarefa correlacionada",()=>{
  const maintenance:HermesOperation={...oracle("completed"),action:"maintenance.execute",taskId:"12345678-1234-4234-8234-123456789abc",maintenanceOperation:"maia.recover",maintenanceExecution:true,verified:true,changed:false,responseText:"Maia saudável"};
  expect(directorRequests([],[maintenance])[0]).toMatchObject({title:"Recuperar Maia",detail:"Maia saudável",group:"completed"});
  for(const patch of [{verified:undefined},{maintenanceExecution:undefined},{taskId:undefined}]) expect(directorRequests([],[{...maintenance,...patch}])[0]).toMatchObject({group:"attention",status:"Conclusão não verificada"});
 });
  it("mostra pedido e retorno da análise sem reclassificar registros legados",()=>{
    const analysis: HermesOperation={...oracle("completed"),action:"agent.analyze",text:"Analisar operação",responseText:"Resultado real",agentExecution:true};
    expect(directorRequests([], [analysis])[0]).toMatchObject({id:analysis.id,title:"Analisar operação",detail:"Resultado real",group:"completed"});
    expect(directorRequests([], [oracle("scheduled")])[0]).toMatchObject({title:"Pedido na caixa interna",detail:"Estado do receptor",status:"Agendado no receptor"});
  });
  it("não trata admissão como conclusão nem mistura identificadores entre receptores", () => {
    const rows = directorRequests([tom("accepted")], [oracle("completed")]);
    expect(rows.map(row => row.agent)).toEqual(["Hermes Oracle", "Tom"]);
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
