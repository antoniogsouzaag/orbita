import type { DispatchView } from "@/server/dispatch";
import type { HermesOperation } from "@/server/hermes";

export type RequestGroup = "open" | "attention" | "completed";
export type DirectorRequest = {
  key: string;
  id: string;
  agent: "Tom" | "Oracle";
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
      key: `oracle:${row.id}`, id: row.id, agent: "Oracle",
      title: ACTIONS[row.action] ?? row.action, status: LABELS[row.status] ?? row.status,
      group: group(row.status, false), createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.checkedAt).toISOString(),
      detail: row.detail, silent: false,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function safeEvidenceUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
