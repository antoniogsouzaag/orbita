import type { DispatchView } from "@/server/dispatch";
import type { HermesOperation } from "@/server/hermes";

export type RequestGroup = "open" | "attention" | "completed";
export type DirectorRequest = {
  key: string;
  id: string;
  agent: "Tom" | "Hermes Oracle";
  title: string;
  status: string;
  group: RequestGroup;
  createdAt: string;
  updatedAt: string;
  detail: string;
  evidence?: string | null;
  silent: boolean;
};

const ACTIONS: Record<string, string> = {
  "request.tom": "Pedido ao Tom",
  "task.dispatch": "Trabalho Hermes",
  "agent.analyze": "Análise Hermes",
  "diagnostics.read": "Diagnóstico",
  "incident.diagnose": "Diagnóstico de incidente",
  "reminder.internal": "Pedido na caixa interna",
};
const LABELS: Record<string, string> = {
  sending: "Enviando", accepted: "Recebido", running: "Em execução",
  completed: "Concluído", failed: "Falhou", rejected: "Recusado",
  unknown: "Envio incerto", scheduled: "Agendado no receptor",
  interrupted: "Interrompido", due: "Vencido na caixa interna",
};

export function verifiedTask(row: HermesOperation) {
 return row.action === "task.dispatch" && row.taskExecution === true && row.verified === true && typeof row.taskId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(row.taskId) && !!row.responseText?.trim();
}
export function verifiedMaintenance(row: HermesOperation) {
 return row.action === "maintenance.execute" && row.maintenanceExecution === true && row.verified === true && typeof row.changed === "boolean" && typeof row.taskId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(row.taskId);
}
function group(status: string, silent: boolean): RequestGroup {
  if (status === "completed") return "completed";
  if (silent || ["unknown", "failed", "rejected", "interrupted", "due"].includes(status)) return "attention";
  return "open";
}

/** Unifica somente a leitura; cada receptor mantém seu contrato e sua persistência. */
export function directorRequests(tom: DispatchView[], oracle: HermesOperation[]): DirectorRequest[] {
  return [
    ...tom.map((row): DirectorRequest => ({
      key: `tom:${row.id}`, id: row.id, agent: "Tom",
      title: typeof row.params?.texto === "string" ? row.params.texto : typeof row.params?.assunto === "string" ? row.params.assunto : ACTIONS[row.action] ?? row.action,
      status: LABELS[row.status] ?? row.status, group: group(row.status, row.silent),
      createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.updatedAt).toISOString(),
      detail: row.summary || row.detail, evidence: row.evidence, silent: row.silent,
    })),
    ...oracle.map((row): DirectorRequest => ({
      key: `oracle:${row.id}`, id: row.id, agent: "Hermes Oracle",
      title: row.action === "maintenance.execute" ? (row.maintenanceOperation === "maia.recover" ? "Recuperar Maia" : `Monitorar domínio ${row.domain ?? ""}`) : row.action === "agent.analyze" && row.text ? row.text : ACTIONS[row.action] ?? row.action, status: ["task.dispatch", "maintenance.execute"].includes(row.action) && row.status === "completed" && !(verifiedTask(row) || verifiedMaintenance(row)) ? "Conclusão não verificada" : LABELS[row.status] ?? row.status,
      group: ["task.dispatch", "maintenance.execute"].includes(row.action) && row.status === "completed" && !(verifiedTask(row) || verifiedMaintenance(row)) ? "attention" : group(row.status, false), createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.checkedAt).toISOString(),
      detail: ((row.action === "agent.analyze" && row.agentExecution) || verifiedMaintenance(row) || verifiedTask(row)) && row.responseText ? row.responseText : row.detail, silent: false,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function safeEvidenceUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
