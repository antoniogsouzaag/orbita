import "server-only";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { withDbTransaction } from "@/db";
import { tasks, dispatches } from "@/db/schema";
import { maintenanceParams, deliverHermesOperation } from "./hermes";
import { assertMaintenanceTask } from "./hermes-maintenance-tasks";
import { storedHermesOperation } from "./hermes-store";

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const inputSchema = z.object({requestId:uuid,operation:z.enum(["maia.recover","monitor.domain.ensure"]),domain:z.string().optional(),task:z.union([z.object({id:uuid}).strict(),z.object({create:z.literal(true),notes:z.string().trim().min(1).max(4000)}).strict()])}).strict();
export type MaintenanceInput = z.infer<typeof inputSchema>;

/** Reserva atômica antes da rede; retry do mesmo UUID apenas lê o histórico. */
export async function dispatchMaintenance(raw: MaintenanceInput) {
 const input = inputSchema.parse(raw);
 const taskId = "id" in input.task ? input.task.id : input.requestId;
 const params = maintenanceParams.parse({task_id:taskId,operation:input.operation,...(input.domain !== undefined ? {domain:input.domain} : {})});
 const fresh = await withDbTransaction(async tx => {
  const [reserved] = await tx.insert(dispatches).values({id:input.requestId,target:"hermes",action:"maintenance.execute",params,status:"sending",detail:"Envio iniciado"}).onConflictDoNothing().returning();
  if (!reserved) {
   const [existing] = await tx.select().from(dispatches).where(eq(dispatches.id,input.requestId));
   if (!existing || existing.target !== "hermes" || existing.action !== "maintenance.execute" || JSON.stringify(maintenanceParams.parse(existing.params)) !== JSON.stringify(params)) throw new Error("UUID já usado para outro pedido.");
   return false;
  }
  if ("create" in input.task) {
   await tx.insert(tasks).values({id:taskId,title:input.operation === "maia.recover" ? "Recuperar Maia" : `Monitorar domínio ${"domain" in params ? params.domain : ""}`,notes:input.task.notes,scope:"empresa",status:"todo",assignee:null,priority:0,tags:[]});
  } else {
   const [task] = await tx.select().from(tasks).where(eq(tasks.id,taskId)).for("update");
   assertMaintenanceTask(task);
  }
  return true;
 });
 const operation = await storedHermesOperation(input.requestId);
 if (!operation) throw new Error("Reserva não encontrada.");
 return fresh ? deliverHermesOperation(operation,params) : operation;
}
