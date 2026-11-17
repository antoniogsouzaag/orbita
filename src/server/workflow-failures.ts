import "server-only";
import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { opsEvents } from "@/db/schema";
import { mergeWorkflowFailures } from "@/lib/workflow-failures";
import type { N8nExecution } from "./ops";
import { resolveOpsEvent } from "./ops-live";

/** Uma consulta limitada às execuções já carregadas, inclusive resoluções fora dos 14 dias. */
export async function workflowFailures(events: (typeof opsEvents.$inferSelect)[], executions: N8nExecution[]) {
  const urls = [...new Set(executions.map(e => e.url))];
  const db = await getDb();
  const stored = urls.length ? await db.select().from(opsEvents).where(and(eq(opsEvents.kind, "workflow_error"), inArray(sql<string>`${opsEvents.detail}->>'executionUrl'`, urls))) : [];
  return mergeWorkflowFailures([...new Map([...events, ...stored].map(e => [e.id, e])).values()], executions);
}

/** Recebe apenas metadados verificados pelo servidor na API n8n. Não executa o workflow. */
export async function resolveVerifiedWorkflowFailure(execution: N8nExecution, evidence: string) {
  const db = await getDb();
  const matching = () => and(eq(opsEvents.kind, "workflow_error"), sql`${opsEvents.detail}->>'executionUrl' = ${execution.url}`);
  let events = await db.select().from(opsEvents).where(matching());
  if (!events.length) {
    await db.insert(opsEvents).values({ kind: "workflow_error", severity: "warning", source: `n8n-api:${new URL(execution.url).origin}`, subject: execution.workflowName,
      createdAt: new Date(execution.startedAt), receiptKey: createHash("sha256").update(JSON.stringify(["n8n-api", execution.url])).digest("hex"),
      detail: { workflowId: execution.workflowId, executionUrl: execution.url } }).onConflictDoNothing({ target: opsEvents.receiptKey });
    events = await db.select().from(opsEvents).where(matching());
  }
  const results = await Promise.all(events.map(e => resolveOpsEvent(e.id, evidence, "proprietario")));
  return results.some(Boolean);
}
