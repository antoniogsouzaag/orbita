import { expect, it } from "vitest";
import type { OpsEvent } from "@/db/schema";
import type { N8nExecution } from "@/server/ops";
import { mergeWorkflowFailures } from "@/lib/workflow-failures";

const url = "https://n8n.example/workflow/flow/executions/1";
const execution = { id: "1", workflowId: "flow", workflowName: "Fixture", status: "error", startedAt: "2026-11-17T12:00:00Z", stoppedAt: null, instance: "VPS-01", url } satisfies N8nExecution;
const event = (id: string, resolved = false, executionUrl = url) => ({ id, kind: "workflow_error", severity: "warning", source: "monitor", subject: "Fixture", receiptKey: null, detail: { executionUrl, resolution: "Conferido na origem" }, createdAt: new Date(execution.startedAt), resolvedAt: resolved ? new Date() : null }) satisfies OpsEvent;

it("não reabre resolução pela API e mantém nova execução pendente", () => {
  const result = mergeWorkflowFailures([event("resolved", true)], [execution, { ...execution, id: "2", url: url + "2" }]);
  expect(result.all).toHaveLength(2);
  expect(result.resolved).toHaveLength(1);
  expect(result.pending[0].url).toBe(url + "2");
});
it("deduplica fontes legadas e prefere resolução independente da ordem", () => {
  for (const events of [[event("open"), event("done", true)], [event("done", true), event("open")]]) {
    expect(mergeWorkflowFailures(events, [execution]).pending).toHaveLength(0);
    expect(mergeWorkflowFailures(events, [execution]).all).toHaveLength(1);
  }
});
it("não agrupa execuções sem URL nem workflows de outra instância", () => {
  expect(mergeWorkflowFailures([event("a", false, ""), event("b", false, "")], [execution, { ...execution, url: url.replace("n8n.", "other.") }]).all).toHaveLength(4);
});
