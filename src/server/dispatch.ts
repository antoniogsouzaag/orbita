import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { dispatches, type Dispatch, type DispatchStatus, type DispatchTarget } from "@/db/schema";

/**
 * Pedidos da Órbita aos diretores de ambiente.
 * O registro é gravado antes do envio; o adaptador do runtime atualiza a admissão
 * e o próprio agente informa execução e resultado por registrar_resultado (MCP).
 */

export const TARGET_LABEL: Record<DispatchTarget, string> = { openclaw: "Tom · OpenClaw (VPS-02)", hermes: "Hermes Oracle · Hermes (VPS-03)" };

/** Estados em que o pedido ainda espera o agente. */
export const OPEN_STATUSES: DispatchStatus[] = ["sending", "accepted", "running"];
const FINAL_STATUSES: DispatchStatus[] = ["rejected", "completed", "failed"];

/** Sem retorno do agente depois deste prazo, a central mostra o pedido como "sem retorno" (não altera o registro). */
export const SILENCE_AFTER_MS = 2 * 3_600_000;

export async function createDispatch(input: { id: string; target: DispatchTarget; action: string; params: Record<string, unknown> }) {
  const db = await getDb();
  const [row] = await db.insert(dispatches).values({ ...input, status: "sending", detail: "Envio iniciado" }).returning();
  return row;
}

export async function updateDispatch(id: string, patch: Partial<Pick<Dispatch, "status" | "detail" | "runId">>) {
  const db = await getDb();
  // O agente pode retornar antes da resposta HTTP. Admissão atrasada nunca
  // regride running/completed/failed para accepted/unknown/rejected.
  const [row] = await db.update(dispatches).set({ ...patch, updatedAt: new Date() }).where(and(eq(dispatches.id, id), eq(dispatches.status, "sending"))).returning();
  if (row) return row;
  if (patch.runId) {
    const [current] = await db.update(dispatches).set({ runId: patch.runId }).where(eq(dispatches.id, id)).returning();
    return current;
  }
  const [current] = await db.select().from(dispatches).where(eq(dispatches.id, id));
  return current;
}

export async function listDispatches(opts: { target?: DispatchTarget; open?: boolean; limit?: number } = {}) {
  const db = await getDb();
  const conds = [opts.target ? eq(dispatches.target, opts.target) : undefined, opts.open ? inArray(dispatches.status, OPEN_STATUSES) : undefined].filter((c) => c !== undefined);
  return db.select().from(dispatches).where(conds.length ? and(...conds) : undefined).orderBy(desc(dispatches.createdAt)).limit(opts.limit ?? 30);
}

/** Pedido aceito ou em execução sem retorno há mais de SILENCE_AFTER_MS. */
export function isSilent(row: Pick<Dispatch, "status" | "updatedAt">, now = Date.now()) {
  return (row.status === "accepted" || row.status === "running") && now - new Date(row.updatedAt).getTime() > SILENCE_AFTER_MS;
}

/** Linha pronta para a tela: o silêncio é calculado no servidor, no momento da leitura. */
export type DispatchView = Dispatch & { silent: boolean };
export const toView = (row: Dispatch, now = Date.now()): DispatchView => ({ ...row, silent: isSilent(row, now) });

export const resultInput = z.object({
  pedido_id: z.uuid(),
  estado: z.enum(["em_execucao", "concluido", "falhou"]),
  resumo: z.string().trim().min(3).max(2000),
  evidencia: z.string().trim().max(500).optional(),
});
const STATE: Record<z.infer<typeof resultInput>["estado"], DispatchStatus> = { em_execucao: "running", concluido: "completed", falhou: "failed" };

/**
 * Resultado informado pelo agente. Aceita repetição idêntica (retry do cliente MCP);
 * não reabre pedido encerrado nem aceita pedido recusado ou com envio incerto.
 */
export async function reportDispatchResult(agent: string, raw: z.input<typeof resultInput>): Promise<{ ok: boolean; message: string }> {
  const input = resultInput.parse(raw);
  const db = await getDb();
  const [row] = await db.select().from(dispatches).where(eq(dispatches.id, input.pedido_id));
  if (!row) return { ok: false, message: "Pedido não encontrado." };
  if (row.target !== "openclaw") return { ok: false, message: "O resultado deste receptor é consultado pelo contrato Hermes dedicado." };
  const status = STATE[input.estado];
  if (row.status === status && row.summary === input.resumo && row.evidence === (input.evidencia ?? null)) return { ok: true, message: "Resultado já registrado." };
  if (FINAL_STATUSES.includes(row.status)) return { ok: false, message: `O pedido já está encerrado (${row.status}).` };
  if (row.status === "running" && status === "running") return { ok: true, message: "Execução já registrada." };
  // "sending"/"unknown" seguem: o agente só recebe o pedido depois da admissão, então o retorno dele resolve a incerteza do envio.
  const finished = status === "completed" || status === "failed";
  const [updated] = await db
    .update(dispatches)
    .set({ status, summary: input.resumo, evidence: input.evidencia ?? null, reportedBy: agent, detail: finished ? "Resultado informado pelo agente." : "Agente iniciou a execução.", updatedAt: new Date(), ...(finished ? { finishedAt: new Date() } : {}) })
    .where(and(eq(dispatches.id, input.pedido_id), eq(dispatches.status, row.status)))
    .returning({ id: dispatches.id });
  if (!updated) {
    const [current] = await db.select().from(dispatches).where(eq(dispatches.id, input.pedido_id));
    if (current?.status === status && current.summary === input.resumo && current.evidence === (input.evidencia ?? null)) return { ok: true, message: "Resultado já registrado." };
    return { ok: false, message: "O pedido mudou durante o registro. Consulte o estado antes de repetir." };
  }
  return { ok: true, message: finished ? "Resultado registrado na Órbita." : "Execução registrada na Órbita." };
}
