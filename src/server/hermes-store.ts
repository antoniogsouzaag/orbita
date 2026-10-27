import "server-only";
import { and, desc, eq, like, notInArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { dispatches, settings } from "@/db/schema";
import { z } from "zod";
import type { HermesOperation } from "./hermes";

function operation(row: typeof dispatches.$inferSelect): HermesOperation {
  const proof = row.action === "maintenance.execute" && row.reportedBy === "hermes:maintenance-execution"
    ? z.object({maintenance_execution:z.literal(true),verified:z.literal(true),changed:z.boolean(),task_id:z.literal(String(row.params.task_id))}).safeParse((()=>{try{return JSON.parse(row.evidence ?? "null");}catch{return null;}})()) : undefined;
  const maintenance = row.action === "maintenance.execute" ? {taskId:String(row.params.task_id),maintenanceOperation:row.params.operation as HermesOperation["maintenanceOperation"],...(typeof row.params.domain === "string" ? {domain:row.params.domain} : {}),...(proof?.success && row.summary !== null ? {maintenanceExecution:true as const,verified:true as const,changed:proof.data.changed,responseText:row.summary} : {})} : {};

  return { ...maintenance, id: row.id, action: row.action as HermesOperation["action"], status: row.status as HermesOperation["status"], createdAt: row.createdAt.toISOString(), checkedAt: row.updatedAt.toISOString(), detail: row.detail, ...(row.action === "agent.analyze" ? { text: typeof row.params.text === "string" ? row.params.text : undefined, ...(row.summary !== null && row.reportedBy === "hermes:agent-execution" ? { responseText: row.summary, agentExecution: true as const } : {}) } : {}) };
}

/** Novos pedidos no registro comum; estados finais nunca regridem após consulta concorrente. */
export async function saveHermesOperation(value: HermesOperation, params: Record<string, unknown> = {}) {
  const db = await getDb();
  const final = ["completed", "failed", "interrupted", "due"].includes(value.status);
  const values = { id: value.id, target: "hermes" as const, action: value.action, status: value.status, params, summary: value.responseText ?? null, reportedBy: value.maintenanceExecution && value.verified ? "hermes:maintenance-execution" : value.agentExecution ? "hermes:agent-execution" : null, evidence: value.maintenanceExecution && value.verified ? JSON.stringify({maintenance_execution:true,verified:true,changed:value.changed,task_id:value.taskId}) : null, detail: value.detail, createdAt: new Date(value.createdAt), updatedAt: new Date(value.checkedAt), finishedAt: final ? new Date(value.checkedAt) : null };
  await db.insert(dispatches).values(values).onConflictDoUpdate({ target: dispatches.id,
    set: { status: value.status, summary: values.summary, evidence: values.evidence, reportedBy: values.reportedBy, detail: value.detail, updatedAt: values.updatedAt, finishedAt: values.finishedAt },
    setWhere: and(eq(dispatches.target, "hermes"), notInArray(dispatches.status, ["completed", "failed", "interrupted", "due"])),
  });
  const [row] = await db.select().from(dispatches).where(and(eq(dispatches.id, value.id), eq(dispatches.target, "hermes")));
  if (!row) throw new Error("Pedido Hermes não encontrado após persistência");
  return operation(row);
}

export async function storedHermesOperation(id: string): Promise<HermesOperation | undefined> {
  const db = await getDb();
  const [row] = await db.select().from(dispatches).where(and(eq(dispatches.id, id), eq(dispatches.target, "hermes")));
  if (row) return operation(row);
  const [legacy] = await db.select().from(settings).where(eq(settings.key, `hermes-operation:${id}`));
  return legacy?.value as HermesOperation | undefined;
}

/** Leitura compatível; registros legados só migram quando consultados no receptor. */
export async function storedHermesHistory(): Promise<HermesOperation[]> {
  const db = await getDb();
  const [current, legacy] = await Promise.all([
    db.select().from(dispatches).where(eq(dispatches.target, "hermes")).orderBy(desc(dispatches.createdAt)).limit(30),
    db.select().from(settings).where(like(settings.key, "hermes-operation:%")).orderBy(desc(sql`${settings.value}->>'createdAt'`)).limit(30),
  ]);
  const merged = new Map(legacy.map(row => { const item = row.value as HermesOperation; return [item.id, item] as const; }));
  for (const row of current) merged.set(row.id, operation(row));
  return [...merged.values()].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,30);
}
