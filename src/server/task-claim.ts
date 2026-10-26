import "server-only";
import { and, asc, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { agentTokens, tasks, type Task } from "@/db/schema";
import { OWNER_NAME } from "@/lib/task-assignee";

/**
 * Fila de execução da Empresa. Cada tarefa principal tem no máximo um responsável;
 * assumir é uma única instrução condicional, então dois agentes nunca ficam com a mesma tarefa.
 * O proprietário pode reatribuir pela interface (patchTask), o que sobrepõe a reserva.
 */

const uuid = z.string().uuid();
const NOTES_LIMIT = 64_000;

export type ClaimOutcome =
  | { ok: true; id: string; title: string; already: boolean }
  | { ok: false; reason: "nao_encontrada" | "concluida" | "ocupada" | "nao_e_sua"; holder?: string | null; since?: Date | null };

const entry = (who: string, what: string, note?: string) => `\n\n---\n${who} · ${new Date().toISOString()} · ${what}${note ? `\n${note}` : ""}`;

/** Tarefas principais da Empresa (escopo interno), abertas. */
const openCompany = (id: string) => and(eq(tasks.id, id), eq(tasks.scope, "empresa"), isNull(tasks.parentId));

export async function claimTask(id: string, who: string, note?: string): Promise<ClaimOutcome> {
  const taskId = uuid.parse(id);
  const db = await getDb();
  const block = entry(who, "assumiu", note);
  const [row] = await db
    .update(tasks)
    .set({
      assignee: who,
      // Reafirmar a própria reserva não reinicia o relógio.
      claimedAt: sql`case when ${tasks.assignee} = ${who} then coalesce(${tasks.claimedAt}, now()) else now() end`,
      status: "doing",
      completedAt: null,
      notes: sql`case when ${tasks.assignee} = ${who} and ${tasks.status} = 'doing' then ${tasks.notes} when length(coalesce(${tasks.notes}, '')) + length(${block}) <= ${NOTES_LIMIT} then coalesce(${tasks.notes}, '') || ${block} else ${tasks.notes} end`,
    })
    .where(and(openCompany(taskId), ne(tasks.status, "done"), or(isNull(tasks.assignee), eq(tasks.assignee, who))))
    .returning({ id: tasks.id, title: tasks.title });
  if (row) return { ok: true, id: row.id, title: row.title, already: false };
  return explain(taskId, who);
}

/** Devolve a tarefa à fila (A fazer, sem responsável). Só quem a assumiu pode liberar. */
export async function releaseTask(id: string, who: string, note: string): Promise<ClaimOutcome> {
  const taskId = uuid.parse(id);
  const db = await getDb();
  const block = entry(who, "liberou", note);
  const [row] = await db
    .update(tasks)
    .set({ assignee: null, claimedAt: null, status: "todo", notes: sql`case when length(coalesce(${tasks.notes}, '')) + length(${block}) <= ${NOTES_LIMIT} then coalesce(${tasks.notes}, '') || ${block} else ${tasks.notes} end` })
    .where(and(openCompany(taskId), ne(tasks.status, "done"), eq(tasks.assignee, who)))
    .returning({ id: tasks.id, title: tasks.title });
  if (row) return { ok: true, id: row.id, title: row.title, already: false };
  const why = await explain(taskId, who);
  return why.ok ? { ok: false, reason: "nao_e_sua", holder: null } : why;
}

async function explain(taskId: string, who: string): Promise<ClaimOutcome> {
  const db = await getDb();
  const [cur] = await db.select({ id: tasks.id, title: tasks.title, status: tasks.status, assignee: tasks.assignee, claimedAt: tasks.claimedAt }).from(tasks).where(openCompany(taskId));
  if (!cur) return { ok: false, reason: "nao_encontrada" };
  if (cur.status === "done") return { ok: false, reason: "concluida", holder: cur.assignee };
  if (cur.assignee && cur.assignee !== who) return { ok: false, reason: "ocupada", holder: cur.assignee, since: cur.claimedAt };
  if (cur.assignee === who) return { ok: true, id: cur.id, title: cur.title, already: true };
  return { ok: false, reason: "nao_e_sua", holder: null };
}

export function claimMessage(r: ClaimOutcome, action: "assumir" | "liberar") {
  if (r.ok) return action === "assumir" ? `Tarefa ${r.id} assumida: “${r.title}”. Status em andamento; registre progresso com atualizar_minha_tarefa.` : `Tarefa ${r.id} devolvida à fila (a fazer, sem responsável).`;
  switch (r.reason) {
    case "nao_encontrada": return "Tarefa não encontrada entre as tarefas principais da Empresa.";
    case "concluida": return "A tarefa já foi concluída.";
    case "ocupada": return `Tarefa já assumida por ${r.holder}${r.since ? ` desde ${r.since.toISOString()}` : ""}. Escolha outra na fila_empresa ou combine com o responsável.`;
    case "nao_e_sua": return "Só quem assumiu a tarefa pode liberá-la.";
  }
}

/** Fila da Empresa: livres por prioridade e antiguidade; depois as que já têm responsável. */
export async function companyQueue(limit = 60): Promise<Task[]> {
  const db = await getDb();
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.scope, "empresa"), isNull(tasks.parentId), ne(tasks.status, "done")))
    .orderBy(sql`case when ${tasks.assignee} is null then 0 else 1 end`, desc(tasks.priority), sql`${tasks.dueDate} asc nulls last`, asc(tasks.createdAt))
    .limit(limit);
}

/** Sugestões para o campo Responsável: o proprietário, agentes com acesso ativo e nomes já usados. */
export async function assigneeOptions(): Promise<string[]> {
  const db = await getDb();
  const [agents, used] = await Promise.all([
    db.selectDistinct({ name: agentTokens.name }).from(agentTokens).where(eq(agentTokens.revoked, false)),
    db.selectDistinct({ name: tasks.assignee }).from(tasks).where(sql`${tasks.assignee} is not null`),
  ]);
  const names = new Set([OWNER_NAME, ...agents.map((a) => a.name), ...used.map((u) => u.name!)]);
  return [...names].sort((a, b) => (a === OWNER_NAME ? -1 : b === OWNER_NAME ? 1 : a.localeCompare(b, "pt-BR")));
}
