import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { agentTokens, tasks } from "@/db/schema";
import { ANSWERED_TAG, githubRepoPattern, githubSourceTag, replyText, type ProposalSource } from "@/lib/proposals";
import { agentSlug } from "@/lib/team";
import { githubInbox, githubProposalBody } from "./github-inbox";

export const proposalReplySchema = z.object({
  source: z.discriminatedUnion("kind", [z.object({ kind: z.literal("github"), repo: z.string().regex(githubRepoPattern), number: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }), z.object({ kind: z.literal("task"), id: z.uuid() })]),
  requestId: z.uuid(), message: z.string().trim().min(2).max(4000).refine(v => !v.includes("<!-- orbita-reply:")),
  agent: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
});

export async function replyAgents() {
  const db = await getDb();
  const rows = await db.select({ name: agentTokens.name, scopes: agentTokens.scopes }).from(agentTokens).where(eq(agentTokens.revoked, false));
  return [...new Map(rows.filter(row => row.scopes.includes("admin") || row.scopes.includes("tarefas")).map(row => [agentSlug(row.name), { id: agentSlug(row.name), name: row.name }])).values()];
}

export async function proposalTasks() {
  const db = await getDb();
  return db.select().from(tasks).where(and(eq(tasks.scope, "empresa"), sql`exists (select 1 from unnest(${tasks.tags}) tag where tag like 'agente:%') and not ('pedido:orbe' = any(${tasks.tags}))`)).orderBy(desc(tasks.createdAt)).limit(200);
}

export async function proposalSource(source: ProposalSource, details = false) {
  if (source.kind === "task") {
    const db = await getDb();
    const [task] = await db.select().from(tasks).where(and(eq(tasks.id, source.id), eq(tasks.scope, "empresa"), sql`exists (select 1 from unnest(${tasks.tags}) tag where tag like 'agente:%') and not ('pedido:orbe' = any(${tasks.tags}))`));
    return task ? { title: task.title, notes: task.notes ?? "", url: `/tarefas?escopo=empresa&task=${task.id}`, task, sourceTag: null } : null;
  }
  const inbox = await githubInbox();
  if (inbox.error || inbox.stale) throw Error("GitHub indisponível. Atualize a consulta antes de responder.");
  const item = inbox.items.find(item => item.kind === "proposta" && item.stage === "decision" && item.repo === source.repo && item.number === source.number);
  if (!item) return null;
  const sourceTag = githubSourceTag(item.url);
  if (!sourceTag) return null;
  const body = details ? await githubProposalBody(item, inbox.org) : null;
  const repo = item.repo.includes("/") ? item.repo : `${inbox.org}/${item.repo}`;
  return { title: item.title, notes: body ?? `${repo} #${item.number} · proposta de ${item.author}. Abra a origem para ler o conteúdo completo.`, url: item.url, task: null, sourceTag };
}

function githubTaskId(source: string) {
  const h = createHash("sha256").update(`orbita:proposal:${source}`).digest("hex").slice(0, 32).split("");
  h[12] = "8"; h[16] = "a";
  const v = h.join("");
  return `${v.slice(0, 8)}-${v.slice(8, 12)}-${v.slice(12, 16)}-${v.slice(16, 20)}-${v.slice(20)}`;
}

/** Uma escrita atômica, compatível também com Neon HTTP; nenhuma transação remota ou webhook. */
export async function saveProposalReply(raw: z.input<typeof proposalReplySchema>) {
  const input = proposalReplySchema.parse(raw);
  const [agents, source] = await Promise.all([replyAgents(), proposalSource(input.source)]);
  if (!agents.some(agent => agent.id === input.agent)) throw Error("Escolha um agente com acesso ativo às tarefas.");
  if (!source) throw Error("Proposta não encontrada ou indisponível neste espaço.");
  const db = await getDb();
  const marker = `<!-- orbita-reply:${input.requestId} at:`;
  const block = replyText(input.requestId, input.message, source.url);
  const id = source.task?.id ?? githubTaskId(source.sourceTag!);
  const tags = [...(source.task?.tags ?? []).filter(tag => !tag.startsWith("agente:") && tag !== ANSWERED_TAG), `agente:${input.agent}`, ANSWERED_TAG, ...(source.sourceTag ? [source.sourceTag, "retorno:proposta"] : [])];
  const notes = sql`coalesce(${tasks.notes}, '') || ${block}`;
  const unseen = sql`position(${marker} in coalesce(${tasks.notes}, '')) = 0`;
  const fits = sql`length(coalesce(${tasks.notes}, '')) + length(${block}) <= 64000`;
  if (source.task) {
    await db.update(tasks).set({ notes, tags, status: "todo", completedAt: null }).where(and(eq(tasks.id, id), eq(tasks.scope, "empresa"), unseen, fits));
  } else {
    await db.insert(tasks).values({ id, title: `Retomar proposta: ${source.title}`.slice(0, 200), notes: `Proposta: ${source.title}\nOrigem: ${source.url}${block}`, tags, scope: "empresa", status: "todo" })
      .onConflictDoUpdate({ target: tasks.id, set: { notes, tags, status: "todo", completedAt: null }, where: and(eq(tasks.scope, "empresa"), sql`${source.sourceTag!} = any(${tasks.tags})`, unseen, fits) });
  }
  const [saved] = await db.select({ id: tasks.id, notes: tasks.notes }).from(tasks).where(and(eq(tasks.id, id), eq(tasks.scope, "empresa")));
  if (!saved?.notes?.includes(marker)) throw Error("Não foi possível salvar. O histórico pode ter atingido o limite; preserve-o e abra uma nova solicitação.");
  return { id: saved.id };
}
