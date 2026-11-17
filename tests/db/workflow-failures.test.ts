import { expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { opsEvents } from "@/db/schema";
import { resolveVerifiedWorkflowFailure, workflowFailures } from "@/server/workflow-failures";

const execution = { id: "fixture", workflowId: "flow", workflowName: "Fixture antigo", status: "error", startedAt: new Date(Date.now() - 20 * 86400000).toISOString(), stoppedAt: null, instance: "VPS-01", url: "https://n8n.example/workflow/flow/executions/fixture-old" };
it("persiste resolução da API fora dos 14 dias, sem duplicar ou afetar próxima execução", async () => {
  expect(await resolveVerifiedWorkflowFailure(execution, "Correção conferida na origem")).toBe(true);
  expect(await resolveVerifiedWorkflowFailure(execution, "Outro clique não substitui evidência")).toBe(false);
  const result = await workflowFailures([], [execution, { ...execution, url: execution.url + "new" }]);
  expect(result.resolved).toHaveLength(1);
  expect(result.resolved[0].resolution).toBe("Correção conferida na origem");
  expect(result.pending).toHaveLength(1);
  const db = await getDb();
  expect(await db.select().from(opsEvents).where(eq(opsEvents.subject, execution.workflowName))).toHaveLength(1);
});
