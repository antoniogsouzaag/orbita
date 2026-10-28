import "server-only";
import { createHash } from "node:crypto";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { dispatches, tasks, type AgentScope } from "@/db/schema";
import { deliverHermesOperation, taskParams } from "./hermes";
import { storedHermesOperation } from "./hermes-store";
import { assertMaintenanceTask } from "./hermes-maintenance-tasks";

const uuid = taskParams.shape.task_id;
export const workInput = z.object({ task_id: uuid.optional(), title: z.string().trim().min(1).max(200).optional(), brief: taskParams.shape.brief, acceptance: taskParams.shape.acceptance }).strict().refine(v => !!v.task_id || !!v.title, "Informe tarefa ou título para criar.");
export type WorkInput = z.infer<typeof workInput>;
/** Trusted caller only: MCP identity comes from verified bearer; UI from requireAuth. */
export type WorkActor = { kind: "mcp"; id: string; name: string; scopes: AgentScope[] } | { kind: "ui"; id: "owner"; name: "Antonio"; scopes: ["admin"] };

export async function dispatchWork(actor: WorkActor, raw: WorkInput) {
 if (!actor.id || !actor.scopes.some(s => s === "tarefas" || s === "admin")) throw new Error("Escopo tarefas ou admin obrigatório.");
 const input = workInput.parse(raw);
 const requestKey = createHash("sha256").update(JSON.stringify([actor.kind, actor.id, input])).digest("hex");
 const db = await getDb();
 const reserved = await db.transaction(async tx => {
  const [retry] = await tx.select().from(dispatches).where(eq(dispatches.requestKey, requestKey));
  if (retry) return { id: retry.id, fresh: false };
  const id = crypto.randomUUID(), taskId = input.task_id ?? crypto.randomUUID();
  if (input.task_id) {
   const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId)).for("update");
   assertMaintenanceTask(task);
   const [active] = await tx.select().from(dispatches).where(and(eq(dispatches.target, "hermes"), eq(dispatches.action, "task.dispatch"), sql`${dispatches.params}->>'task_id' = ${taskId}`, inArray(dispatches.status, ["sending", "accepted", "running", "unknown"])));
   if (active) return { id: active.id, fresh: false };
   // Bind authority before network; the runtime must confirm this exact owner via MCP.
   await tx.update(tasks).set({ assignee: "Hermes Oracle" }).where(eq(tasks.id, taskId));
  }
  const params = taskParams.parse({ task_id: taskId, brief: input.brief, acceptance: input.acceptance });
  const [created] = await tx.insert(dispatches).values({ id, target: "hermes", action: "task.dispatch", params, origin: { kind: actor.kind, id: actor.id, name: actor.name }, requestKey, status: "sending", detail: "Trabalho reservado; destino fixo Hermes Oracle VPS03." }).onConflictDoNothing().returning();
  if (!created) {
   const [existing] = await tx.select().from(dispatches).where(or(eq(dispatches.requestKey, requestKey), and(eq(dispatches.action, "task.dispatch"), sql`${dispatches.params}->>'task_id' = ${taskId}`, inArray(dispatches.status, ["sending", "accepted", "running", "unknown"]))));
   if (!existing) throw new Error("Reserva concorrente não encontrada; consulte antes de repetir.");
   return { id: existing.id, fresh: false };
  }
  if (!input.task_id) await tx.insert(tasks).values({ id: taskId, title: input.title!, notes: input.brief, scope: "empresa", status: "todo", assignee: "Hermes Oracle", priority: 0, tags: [] });
  return { id, fresh: true };
 });
 const operation = await storedHermesOperation(reserved.id);
 if (!operation) throw new Error("Reserva não encontrada.");
 if (!reserved.fresh) return operation; // never resend, including commit-before-send crashes
 const [row] = await db.select().from(dispatches).where(eq(dispatches.id, reserved.id));
 return deliverHermesOperation(operation, taskParams.parse(row.params));
}
