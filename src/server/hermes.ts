import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { taskProof } from "@/lib/hermes-task-proof";
import { validateMaintenanceTask } from "./hermes-maintenance-tasks";
import { saveHermesOperation, storedHermesOperation, storedHermesHistory } from "./hermes-store";

const idSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
export const maintenanceParams = z.discriminatedUnion("operation", [
 z.object({task_id:idSchema, operation:z.literal("maia.recover")}).strict(),
 z.object({task_id:idSchema, operation:z.literal("monitor.domain.ensure"), domain:z.string().regex(/^(?!xn--)(?!(?:com|api|ia|app)\.br$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:(?:com|api|ia|app)\.)?br$/, "Use nome.br ou nome.(com|api|ia|app).br em ASCII minúsculo, sem punycode ou subdomínio.")}).strict(),
]);
export const taskParams = z.object({ task_id: idSchema, brief: z.string().trim().min(1).max(12000), acceptance: z.string().trim().min(1).max(4000) }).strict();
export const hermesCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("task.dispatch"), params: taskParams }).strict(),
  z.object({action:z.literal("maintenance.execute"),params:maintenanceParams}).strict(),
  z.object({ action: z.literal("agent.analyze"), params: z.object({ text: z.string().trim().min(1).max(4000) }).strict() }).strict(),
  z.object({ action: z.literal("diagnostics.read"), params: z.object({}).strict() }).strict(),
  z.object({ action: z.literal("reminder.internal"), params: z.object({ text: z.string().trim().min(1).max(1000), due_at: z.number().int() }).strict() }).strict(),
]);
type Command = z.infer<typeof hermesCommand>;
export type HermesOperation = { id: string; action: Command["action"]; status: "sending" | "running" | "accepted" | "scheduled" | "completed" | "failed" | "interrupted" | "due" | "unknown"; createdAt: string; checkedAt: string; detail: string; taskExecution?: true; sessionId?: string; evidence?: string[]; text?: string; responseText?: string; agentExecution?: true; taskId?: string; maintenanceOperation?: "maia.recover" | "monitor.domain.ensure"; domain?: string; maintenanceExecution?: true; verified?: true; changed?: boolean };
export function hermesConfiguration() {
  return { enabled: process.env.HERMES_DISPATCH_ENABLED === "true", endpointConfigured: !!process.env.HERMES_WEBHOOK_URL, secretConfigured: !!process.env.HERMES_WEBHOOK_SECRET };
}
export function hermesHeaders(secret: string, body: string, id: string, timestamp = Math.floor(Date.now() / 1000)) {
  return { "Content-Type": "application/json", "X-Request-Id": id, "X-Webhook-Timestamp": String(timestamp), "X-Webhook-Signature-V2": createHmac("sha256", secret).update(`${timestamp}.${body}`, "utf8").digest("hex") };
}
async function request(id: string, action: Command["action"] | "result.read", params: Record<string, unknown>) {
  const config = hermesConfiguration();
  if (!config.enabled || !config.endpointConfigured || !config.secretConfigured) throw new Error("Despacho não ativado. Configure serviço, rota e chave dedicada no servidor.");
  const url = new URL(process.env.HERMES_WEBHOOK_URL!);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/webhooks/orbita-hermes") throw new Error("Use a rota HTTPS dedicada do Hermes.");
  const body = JSON.stringify({ version: 2, source: "orbita", request_id: id, action, params });
  const response = await fetch(url, { method: "POST", headers: hermesHeaders(process.env.HERMES_WEBHOOK_SECRET!, body, id), body, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Receptor respondeu HTTP ${response.status}.`);
  const payload = await response.json();
  if (payload.request_id !== id || (action !== "result.read" && (response.status !== 202 || payload.status !== "accepted" || payload.action !== action)) || (action === "result.read" && response.status !== 200)) throw new Error("Resposta sem correlação válida.");
  return payload as { request_id: string; action: string; status: string; result?: unknown };
}
export async function dispatchHermes(input: Command): Promise<HermesOperation> {
  const command = hermesCommand.parse(input);
  if (command.action === "task.dispatch") throw new Error("Use o fluxo task-backed autenticado.");
  const now = Math.floor(Date.now() / 1000);
  if (command.action === "reminder.internal" && (command.params.due_at < now + 60 || command.params.due_at > now + 365 * 86400)) throw new Error("Escolha um prazo entre um minuto e 365 dias.");
  if (command.action === "maintenance.execute") await validateMaintenanceTask(command.params.task_id);
  const id = crypto.randomUUID();
  const operation: HermesOperation = { id, action: command.action, status: "sending", createdAt: new Date().toISOString(), checkedAt: new Date().toISOString(), detail: "Envio iniciado", ...(command.action === "agent.analyze" ? { text: command.params.text } : command.action === "maintenance.execute" ? {taskId:command.params.task_id,maintenanceOperation:command.params.operation,...("domain" in command.params ? {domain:command.params.domain} : {})} : {}) };
  await saveHermesOperation(operation, command.params);
  return deliverHermesOperation(operation, command.params);
}
/** Somente depois de persistir a reserva do UUID; nunca repetir envio incerto. */
export async function deliverHermesOperation(initial: HermesOperation, params: Record<string, unknown>) {
  let operation = initial;
  try { await request(operation.id, operation.action, params); operation = { ...operation, status: "accepted", detail: "Recebido e persistido pelo Hermes. Consulte o resultado." }; }
  catch (error) { operation = { ...operation, status: "unknown", detail: error instanceof Error && /^(Receptor|Resposta|Despacho|Use a rota)/.test(error.message) ? error.message : "Resultado do envio desconhecido. Consulte este identificador antes de reenviar." }; }
  return saveHermesOperation(operation);
}
export async function readHermesResult(input: string): Promise<HermesOperation> {
  const id = idSchema.parse(input);
  const previous = await storedHermesOperation(id);
  if (!previous) throw new Error("Operação não encontrada.");
  const result = await request(id, "result.read", {});
  const status = (["task.dispatch", "agent.analyze", "maintenance.execute"].includes(previous.action)
    ? z.enum(["accepted", "running", "completed", "failed", "interrupted"])
    : z.enum(["accepted", "scheduled", "completed", "failed", "interrupted", "due"])).parse(result.status);
  if (result.action !== previous.action) throw new Error("Ação divergente na resposta.");
  const analysis = previous.action === "agent.analyze" && status === "completed"
    ? z.object({ response_text: z.string().refine(text => text.trim().length > 0), agent_execution: z.literal(true) }).parse(result.result)
    : undefined;
  const maintenance = previous.action === "maintenance.execute" && status === "completed"
    ? z.object({response_text:z.string().refine(text=>text.trim().length>0),maintenance_execution:z.literal(true),verified:z.literal(true),changed:z.boolean(),task_id:idSchema.refine(id=>id===previous.taskId)}).parse(result.result) : undefined;
  const task = previous.action === "task.dispatch" && status === "completed" ? taskProof.refine(p => p.task_id === previous.taskId).parse(result.result) : undefined;
  const operation = { ...previous, ...(task ? { taskExecution: true as const, verified: true as const, responseText: task.response_text, sessionId: task.session_id, evidence: task.evidence } : {}), ...(maintenance ? {responseText:maintenance.response_text,maintenanceExecution:true as const,verified:true as const,changed:maintenance.changed} : {}), ...(analysis ? { responseText: analysis.response_text, agentExecution: analysis.agent_execution } : {}), status, checkedAt: new Date().toISOString(), detail: status === "completed" ? "Execução concluída pelo receptor." : status === "due" ? "Lembrete vencido na caixa interna." : `Estado informado pelo receptor: ${status}` };
  // Só o texto de análise comprovada é exposto; resultados técnicos legados continuam privados.
  return saveHermesOperation(operation);
}
export async function hermesHistory(): Promise<HermesOperation[]> { return storedHermesHistory(); }
