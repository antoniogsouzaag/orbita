import type { OpsEvent } from "@/db/schema";
import type { N8nExecution } from "@/server/ops";

export type WorkflowFailure = {
  key: string; id?: string; url?: string; name: string; instance: string;
  createdAt: Date; resolvedAt: Date | null; resolution?: string; node?: string;
};

/** A execução identifica a ocorrência; resolução não pode reaparecer pela outra fonte. */
export function mergeWorkflowFailures(events: OpsEvent[], executions: N8nExecution[]) {
  const rows = new Map<string, WorkflowFailure>();
  for (const e of executions) rows.set(e.url, { key: e.url, url: e.url, name: e.workflowName, instance: e.instance, createdAt: new Date(e.startedAt), resolvedAt: null });
  for (const e of events.filter(e => e.kind === "workflow_error")) {
    const url = typeof e.detail.executionUrl === "string" && e.detail.executionUrl ? e.detail.executionUrl : undefined;
    const key = url ?? e.id;
    const prev = rows.get(key);
    // Duas entregas legadas podem existir; uma resolução explícita prevalece.
    if (prev?.resolvedAt && !e.resolvedAt) continue;
    rows.set(key, { key, id: e.id, url, name: e.subject, instance: prev?.instance ?? e.source, createdAt: prev?.createdAt ?? e.createdAt, resolvedAt: e.resolvedAt,
      resolution: typeof e.detail.resolution === "string" ? e.detail.resolution : undefined,
      node: typeof e.detail.node === "string" ? e.detail.node : undefined });
  }
  const all = [...rows.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return { all, pending: all.filter(e => !e.resolvedAt), resolved: all.filter(e => e.resolvedAt) };
}
