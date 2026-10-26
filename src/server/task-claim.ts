import "server-only";
import { and, asc, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { getDb } from "@/db";
import { agentTokens, tasks, type Task } from "@/db/schema";
import { OWNER_NAME } from "@/lib/task-assignee";

/**
 * Fila de execução da Empresa. Cada tarefa (ou parte de uma tarefa dividida) tem no máximo um responsável;
 * assumir é uma única instrução condicional, então dois agentes nunca ficam com a mesma tarefa.
 * O proprietário pode reatribuir pela interface (patchTask), o que sobrepõe a reserva.
 */

const uuid = z.string().uuid();
const NOTES_LIMIT = 64_000;

export type ClaimOutcome =
  | { ok: true; id: string; title: string; already: boolean }
  | { ok: false; reason: "nao_encontrada" | "concluida" | "ocupada" | "nao_e_sua"; holder?: string | null; since?: Date | null };

const entry = (who: string, what: string, note?: string) => `\n\n---\n${who} · ${new Date().toISOString()} · ${what}${note ? `\n${note}` : ""}`;

/** Tarefa interna da Empresa: principal ou parte (subtarefa) cuja principal é da Empresa. */
const companyScope = sql`coalesce((select principal.scope from ${tasks} principal where principal.id = ${tasks.parentId}), ${tasks.scope}) = 'empresa'`;
const openCompany = (id: string) => and(eq(tasks.id, id), companyScope);

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
    case "nao_encontrada": return "Tarefa não encontrada entre as tarefas internas da Empresa.";
    case "concluida": return "A tarefa já foi concluída.";
    case "ocupada": return `Tarefa já assumida por ${r.holder}${r.since ? ` desde ${r.since.toISOString()}` : ""}. Escolha outra na fila_empresa ou combine com o responsável.`;
    case "nao_e_sua": return "Só quem assumiu a tarefa pode liberá-la.";
  }
}

export type QueueItem = Task & { parentTitle: string | null; parts: { total: number; done: number } };

/** Fila da Empresa: livres por prioridade e antiguidade; depois as que já têm responsável. Inclui partes de tarefas divididas. */
export async function companyQueue(limit = 80): Promise<QueueItem[]> {
  const db = await getDb();
  const parent = alias(tasks, "parent_task");
  const rows = await db
    .select({
      task: tasks,
      parentTitle: parent.title,
      partsTotal: sql<number>`(select count(*) from ${tasks} part where part.parent_id = ${tasks.id})::int`,
      partsDone: sql<number>`(select count(*) from ${tasks} part where part.parent_id = ${tasks.id} and part.status = 'done')::int`,
    })
    .from(tasks)
    .leftJoin(parent, eq(parent.id, tasks.parentId))
    .where(and(ne(tasks.status, "done"), sql`coalesce(${parent.scope}, ${tasks.scope}) = 'empresa'`, sql`(${parent.id} is null or ${parent.status} <> 'done')`))
    .orderBy(sql`case when ${tasks.assignee} is null then 0 else 1 end`, desc(tasks.priority), sql`${tasks.dueDate} asc nulls last`, asc(tasks.createdAt), asc(tasks.sort))
    .limit(limit);
  return rows.map((r) => ({ ...r.task, parentTitle: r.parentTitle, parts: { total: r.partsTotal, done: r.partsDone } }));
}

export const splitInput = z.object({
  partes: z.array(z.object({
    titulo: z.string().trim().min(8).max(200),
    pronto_quando: z.string().trim().min(8).max(600),
  })).min(2).max(12),
  motivo: z.string().trim().min(3).max(1000),
});

export type SplitOutcome =
  | { ok: true; parts: { id: string; title: string }[]; repeated: boolean }
  | { ok: false; message: string };

/**
 * Divide uma tarefa grande em partes específicas (subtarefas) que podem ser assumidas uma a uma.
 * Uma única instrução: libera a principal, registra a divisão e cria as partes. registro_id torna a repetição segura.
 */
export async function splitTask(id: string, who: string, registro: string, input: z.input<typeof splitInput>): Promise<SplitOutcome> {
  const taskId = uuid.parse(id);
  const requestId = uuid.parse(registro);
  const v = splitInput.parse(input);
  const titles = v.partes.map((p) => p.titulo.toLowerCase());
  if (new Set(titles).size !== titles.length) return { ok: false, message: "As partes precisam ter títulos diferentes." };
  const db = await getDb();
  const marker = `<!-- orbita-split:${requestId} -->`;
  const list = v.partes.map((p) => `- ${p.titulo}`).join("\n");
  const block = `${entry(who, `dividiu em ${v.partes.length} partes`, `${v.motivo}\n${list}`)}\n${marker}`;
  const parts = JSON.stringify(v.partes.map((p) => ({ title: p.titulo, notes: `Pronto quando: ${p.pronto_quando}` })));
  const created: unknown = await db.execute(sql`with principal as (
      update ${tasks} set assignee = null, claimed_at = null, status = 'todo', notes = coalesce(${tasks.notes}, '') || ${block}
      where ${tasks.id} = ${taskId} and ${tasks.parentId} is null and ${tasks.scope} = 'empresa' and ${tasks.status} <> 'done'
        and (${tasks.assignee} is null or ${tasks.assignee} = ${who})
        and position(${marker} in coalesce(${tasks.notes}, '')) = 0
        and length(coalesce(${tasks.notes}, '')) + length(${block}) <= ${NOTES_LIMIT}
      returning id, project_id, priority, tags
    )
    insert into ${tasks} (title, notes, parent_id, scope, project_id, priority, tags, sort)
    select part.value->>'title', part.value->>'notes', principal.id, 'empresa', principal.project_id, principal.priority, principal.tags, part.ord::int
    from principal, jsonb_array_elements(${parts}::jsonb) with ordinality as part(value, ord)
    returning id, title`);
  // neon-http e PGlite devolvem { rows }; postgres-js devolve a lista.
  const rows = (Array.isArray(created) ? created : (created as { rows: unknown[] }).rows) as { id: string; title: string }[];
  if (rows.length) return { ok: true, parts: rows, repeated: false };

  const [cur] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!cur || cur.scope !== "empresa") return { ok: false, message: "Tarefa não encontrada entre as tarefas internas da Empresa." };
  if (cur.notes?.includes(marker)) {
    const existing = await db.select({ id: tasks.id, title: tasks.title }).from(tasks).where(eq(tasks.parentId, taskId)).orderBy(asc(tasks.sort));
    return { ok: true, parts: existing, repeated: true };
  }
  if (cur.parentId) return { ok: false, message: "Esta já é uma parte. Divida a tarefa principal ou registre o andamento desta parte." };
  if (cur.status === "done") return { ok: false, message: "A tarefa já foi concluída." };
  if (cur.assignee && cur.assignee !== who) return { ok: false, message: `Tarefa assumida por ${cur.assignee}; só o responsável ou uma tarefa livre pode ser dividida.` };
  return { ok: false, message: "Histórico da tarefa no limite; registre a divisão pela interface." };
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
