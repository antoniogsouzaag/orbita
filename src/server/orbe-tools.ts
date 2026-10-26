import "server-only";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { agentActivity, ORBE_MEMORY_SCOPES } from "@/db/schema";
import { OWNER_NAME, assigneeLabel, elapsed } from "@/lib/task-assignee";
import { taskHref } from "@/lib/task-scope";
import { listDispatches, isSilent, TARGET_LABEL } from "./dispatch";
import { dispatchOpenclaw, openclawConfiguration } from "./openclaw";
import { addMemory, removeMemory, replaceMemory } from "./orbe-memory";
import { searchConversations } from "./orbe-conversations";
import { assigneeOptions, companyQueue } from "./task-claim";
import { insertTask } from "./task-write";

/** Ferramentas próprias da ORBE (não viram orbita_* no MCP: agentes têm as suas). */

type ActionResult = { text: string; action?: { label: string; href: string } };

/* ───────────── Memória ───────────── */

export const memoriaSchema = z.object({
  acao: z.enum(["adicionar", "substituir", "remover"]),
  espaco: z.enum(ORBE_MEMORY_SCOPES).describe("geral = jeito de trabalhar com Antonio (vale nos dois espaços); ou o espaço atual"),
  texto: z.string().max(400).nullish().describe("Anotação nova, curta e autossuficiente (adicionar/substituir)"),
  trecho_antigo: z.string().max(200).nullish().describe("Trecho único da anotação existente (substituir/remover)"),
});

export const memoria = {
  schema: memoriaSchema,
  async run(v: z.infer<typeof memoriaSchema>): Promise<ActionResult> {
    const r = v.acao === "adicionar" ? (v.texto ? await addMemory(v.espaco, v.texto) : { ok: false, message: "Informe o texto." })
      : v.acao === "substituir" ? (v.texto && v.trecho_antigo ? await replaceMemory(v.espaco, v.trecho_antigo, v.texto) : { ok: false, message: "Informe trecho_antigo e o texto novo." })
      : v.trecho_antigo ? await removeMemory(v.espaco, v.trecho_antigo) : { ok: false, message: "Informe trecho_antigo." };
    if (!r.ok) throw new ToolRefusal(r.message);
    const verb = v.acao === "adicionar" ? "guardou" : v.acao === "substituir" ? "atualizou" : "removeu";
    return { text: r.message, action: { label: `Memória: ${verb}${v.texto ? ` “${v.texto.length > 60 ? `${v.texto.slice(0, 57)}…` : v.texto}”` : ""}`, href: "/ia?memoria=1" } };
  },
};

/** Recusa explicada ao modelo (limite cheio, trecho ambíguo), sem esconder o motivo. */
export class ToolRefusal extends Error {}

/* ───────────── Conversas anteriores ───────────── */

export const buscarConversasSchema = z.object({
  consulta: z.string().trim().min(3).max(200).describe("Palavras-chave do assunto"),
  escopo: z.enum(["pessoal", "empresa"]).nullish(),
});

export const buscarConversas = {
  schema: buscarConversasSchema,
  async run(v: z.infer<typeof buscarConversasSchema>): Promise<ActionResult> {
    const hits = await searchConversations(v.escopo ?? "pessoal", v.consulta);
    if (!hits.length) return { text: "Nenhuma conversa anterior deste espaço menciona isso (as conversas ficam guardadas por tempo limitado)." };
    return { text: hits.map((h) => `### ${h.title} · ${h.updatedAt.toISOString().slice(0, 10)}\n${h.excerpt}`).join("\n\n") };
  },
};

/* ───────────── Agentes ───────────── */

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const slug = (s: string) => fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Nome oficial do agente a partir do que Antonio disse ("tom", "hermes oracle"). */
export async function resolveAgent(name: string): Promise<{ name: string } | { options: string[] }> {
  const options = (await assigneeOptions()).filter((n) => n !== OWNER_NAME);
  const wanted = fold(name);
  const exact = options.find((o) => fold(o) === wanted);
  if (exact) return { name: exact };
  const partial = options.filter((o) => fold(o).split(/\s+/).includes(wanted) || fold(o).startsWith(wanted));
  return partial.length === 1 ? { name: partial[0] } : { options };
}

const PRIORIDADE = { baixa: 1, media: 2, alta: 3 } as const;

export const pedirAgenteSchema = z.object({
  agente: z.string().trim().min(2).max(80).describe("Nome do agente (ex.: Tom, Hermes Oracle, Linus)"),
  pedido: z.string().trim().min(5).max(200).describe("Título curto e acionável: verbo + objeto + produto"),
  detalhe: z.string().trim().max(3000).nullish().describe("Contexto, critério de pronto e limites combinados com Antonio"),
  prioridade: z.enum(["baixa", "media", "alta"]).nullish(),
  prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
});

export const pedirAgente = {
  schema: pedirAgenteSchema,
  async run(v: z.infer<typeof pedirAgenteSchema>): Promise<ActionResult> {
    const agent = await resolveAgent(v.agente);
    if (!("name" in agent)) throw new ToolRefusal(`Agente “${v.agente}” não encontrado. Agentes com acesso à Órbita: ${agent.options.join(", ") || "nenhum"}. Confirme o nome com Antonio.`);
    const notes = `Pedido de ${OWNER_NAME} pela ORBE em ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC.${v.detalhe ? `\n\n${v.detalhe}` : ""}\n\nRegistre andamento e conclusão com atualizar_minha_tarefa, com evidência.`;
    const id = await insertTask({ title: v.pedido, notes, scope: "empresa", assignee: agent.name, priority: v.prioridade ? PRIORIDADE[v.prioridade] : 2, dueDate: v.prazo ?? null, tags: [`agente:${slug(agent.name)}`, "pedido:orbe"] });
    let extra = " O agente vê o pedido em minhas_tarefas/fila_empresa no próximo ciclo dele.";
    // Tom tem canal direto (gateway OpenClaw): avisa já, apontando para a tarefa.
    if (slug(agent.name).startsWith("tom") && openclawConfiguration().enabled) {
      const sent = await dispatchOpenclaw({ action: "request.tom", params: { texto: `Antonio atribuiu a você a tarefa ${id} na Órbita: ${v.pedido}. Leia o detalhe em minhas_tarefas e registre o resultado.` } }).catch(() => null);
      extra = sent?.status === "accepted" ? " Tom também foi avisado pelo canal direto (pedido admitido pelo gateway)." : ` Aviso direto ao Tom não confirmado (${sent?.status ?? "falha"}); a tarefa continua na fila dele.`;
    }
    return { text: `Pedido criado na fila da Empresa para ${agent.name} (tarefa ${id}).${extra}`, action: { label: `Pedido → ${agent.name}: ${v.pedido}`, href: taskHref("empresa") } };
  },
};

export const statusAgentesSchema = z.object({ agente: z.string().trim().max(80).nullish().describe("Filtrar por um agente") });

export const statusAgentes = {
  schema: statusAgentesSchema,
  async run(v: z.infer<typeof statusAgentesSchema>): Promise<ActionResult> {
    const db = await getDb();
    const [queue, dispatches, activity] = await Promise.all([
      companyQueue(80),
      listDispatches({ limit: 15 }),
      db.select().from(agentActivity).orderBy(desc(agentActivity.createdAt)).limit(40),
    ]);
    const only = v.agente ? fold(v.agente) : null;
    const match = (name: string | null) => !only || (!!name && fold(name).includes(only));
    const owned = queue.filter((t) => t.assignee && t.assignee !== OWNER_NAME && match(t.assignee));
    const free = only ? [] : queue.filter((t) => !t.assignee).slice(0, 8);
    const lines = [
      `## Tarefas com agentes (${owned.length})`,
      ...owned.map((t) => `- ${t.title} (id ${t.id}) · ${assigneeLabel(t)}${t.dueDate ? ` · prazo ${t.dueDate}` : ""}`),
      ...(only ? [] : [`\n## Livres na fila (${queue.filter((t) => !t.assignee).length}, mostrando ${free.length})`, ...free.map((t) => `- ${t.title} (id ${t.id})`)]),
      `\n## Pedidos diretos recentes`,
      ...dispatches.filter((d) => match(TARGET_LABEL[d.target])).map((d) => `- ${TARGET_LABEL[d.target]} · ${d.action} · ${d.status}${isSilent(d) ? " (sem retorno)" : ""} · há ${elapsed(d.createdAt)}${d.summary ? ` — ${d.summary.slice(0, 200)}` : ""}`),
      `\n## Atividade recente no MCP`,
      ...activity.filter((a) => match(a.agent)).slice(0, 15).map((a) => `- ${a.agent} · ${a.summary}${a.ok ? "" : " (erro)"} · há ${elapsed(a.createdAt)}`),
    ];
    return { text: `${lines.join("\n")}\n\nAtividade registrada não comprova entrega; confira a evidência na tarefa.` };
  },
};
