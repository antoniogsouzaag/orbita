import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { agentActivity, agentTokens, opsEvents, tasks, type AgentScope } from "@/db/schema";
import { buildContext, contextToMarkdown } from "./context";
import { liveOps } from "./ops-live";
import { githubInbox } from "./github-inbox";
import { n8nOverview } from "./ops";
import { getVaultIndexSafe, getVaultProvider, searchVault, vaultHealth } from "./vault";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/* ───────────── Tokens por agente ───────────── */

export async function createAgentToken(name: string, scopes: AgentScope[]) {
  const token = `orb_${randomBytes(24).toString("base64url")}`;
  const db = await getDb();
  await db.insert(agentTokens).values({ name, scopes, tokenHash: sha(token), prefix: token.slice(0, 10) });
  return token; // mostrado uma única vez
}

export async function listAgentTokens() {
  const db = await getDb();
  return db.select().from(agentTokens).orderBy(desc(agentTokens.createdAt));
}

export async function revokeAgentToken(id: string) {
  const db = await getDb();
  await db.update(agentTokens).set({ revoked: true }).where(eq(agentTokens.id, id));
}

export type AgentIdentity = { id: string; name: string; scopes: AgentScope[] };

/** Valida o Bearer de um agente (tokens revogados não passam). */
export async function verifyAgentToken(bearer: string | null | undefined): Promise<AgentIdentity | null> {
  if (!bearer || !bearer.startsWith("orb_") || bearer.length < 20) return null;
  const db = await getDb();
  const [row] = await db.select().from(agentTokens).where(and(eq(agentTokens.tokenHash, sha(bearer)), eq(agentTokens.revoked, false)));
  if (!row) return null;
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) await db.update(agentTokens).set({ lastUsedAt: new Date() }).where(eq(agentTokens.id, row.id));
  return { id: row.id, name: row.name, scopes: row.scopes };
}

export async function logActivity(agent: string, tool: string, summary: string, ok = true) {
  const db = await getDb();
  await db.insert(agentActivity).values({ agent, tool, summary: summary.slice(0, 500), ok });
}

export async function recentActivity(limit = 60) {
  const db = await getDb();
  return db.select().from(agentActivity).orderBy(desc(agentActivity.createdAt)).limit(limit);
}

/** Métricas completas da janela, independentes do limite de linhas da atividade. */
export async function agentActivitySummary() {
  const db = await getDb();
  const since = new Date(Date.now() - 24 * 3_600_000);
  const rows = await db.select({
    agent: agentActivity.agent,
    calls: sql<number>`count(*)`.mapWith(Number),
    failures: sql<number>`count(*) filter (where not ${agentActivity.ok})`.mapWith(Number),
  }).from(agentActivity).where(gte(agentActivity.createdAt, since)).groupBy(agentActivity.agent);
  return { since: since.toISOString(), rows };
}

/** Tarefas que os agentes abriram para Antonio (tag "agente:<nome>"). */
export async function agentTasks(agent?: string) {
  const db = await getDb();
  const cond = agent ? sql`${`agente:${slug(agent)}`} = any(${tasks.tags})` : sql`exists (select 1 from unnest(${tasks.tags}) t where t like 'agente:%')`;
  return db.select().from(tasks).where(cond).orderBy(desc(tasks.createdAt)).limit(100);
}

function slug(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Aviso imediato no Telegram quando um agente pede algo a Antonio. */
async function notifyAgentAsk(agent: string, title: string, prio: string | null): Promise<boolean> {
  const { escHtml, sendTelegram, telegramConfigured } = await import("./telegram");
  if (!telegramConfigured()) return false;
  const result = await sendTelegram(`🤖 <b>${escHtml(agent)}</b> pediu${prio === "alta" ? " (prioridade alta)" : ""}:\n${escHtml(title)}\n\n<a href="${process.env.APP_URL ?? "https://orb.aglabs.api.br"}/empresa">Ver na Órbita</a>`).catch(() => ({ ok: false }));
  return result.ok;
}

/* ───────────── Servidor MCP ───────────── */

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };
const text = (t: string, isError = false): ToolResult => ({ content: [{ type: "text", text: t }], ...(isError ? { isError } : {}) });

/** Monta um servidor MCP com as ferramentas permitidas pelos escopos do agente. */
export function buildMcpServer(agent: AgentIdentity) {
  const server = new McpServer({ name: "orbita", version: "1.0.0" }, { instructions: "Órbita: central operacional da AG LABS. Use contexto_operacional para se situar. O vault é a fonte canônica; registre pedidos para Antonio com criar_tarefa_para_antonio e relatos com registrar_evento. Dados pessoais de Antonio não estão disponíveis." });
  const can = (s: AgentScope) => agent.scopes.includes(s);
  const run = async (tool: string, summary: string, fn: () => Promise<ToolResult>) => {
    try {
      const r = await fn();
      await logActivity(agent.name, tool, summary, !r.isError).catch(() => {});
      return r;
    } catch (e) {
      await logActivity(agent.name, tool, `${summary} — erro`, false).catch(() => {});
      return text(`Erro: ${e instanceof Error ? e.message : String(e)}`, true);
    }
  };

  if (can("contexto")) {
    server.registerTool(
      "contexto_operacional",
      { title: "Contexto operacional", description: "Regras do vault, agentes, servidores, aplicações, automações e monitoramento da AG LABS, em markdown.", inputSchema: { ao_vivo: z.boolean().optional().describe("Incluir estado ao vivo (status, incidentes, monitores)") } },
      async ({ ao_vivo }) => run("contexto_operacional", "leu o contexto operacional", async () => text(contextToMarkdown(await buildContext({ live: ao_vivo ?? true })))),
    );
    server.registerTool(
      "buscar_no_vault",
      { title: "Buscar no vault", description: "Busca por palavras-chave nas notas do vault da AG LABS. Retorna caminho, título e trecho.", inputSchema: { consulta: z.string().min(2).max(200) } },
      async ({ consulta }) =>
        run("buscar_no_vault", `buscou “${consulta}”`, async () => {
          if (!getVaultProvider()) return text("Vault não configurado na Órbita.", true);
          const hits = await searchVault(consulta, 10);
          return text(hits.length ? hits.map((h) => `- ${h.title} — \`${h.path}\`\n  ${h.snippet}`).join("\n") : "Nada encontrado.");
        }),
    );
    server.registerTool(
      "ler_nota_do_vault",
      { title: "Ler nota do vault", description: "Lê o conteúdo completo de uma nota do vault pelo caminho (ex.: '02 - Estrutura Interna/Registro de Aplicações.md') ou pelo nome.", inputSchema: { caminho: z.string().min(1).max(400) } },
      async ({ caminho }) =>
        run("ler_nota_do_vault", `leu ${caminho}`, async () => {
          const idx = await getVaultIndexSafe();
          if (!idx) return text((await vaultHealth()).error ?? "Vault não configurado na Órbita.", true);
          const p = idx.notes.has(caminho) ? caminho : idx.resolve(caminho.replace(/\.md$/i, ""));
          const note = p ? idx.notes.get(p) : null;
          return note ? text(`# ${note.title}\n_caminho: ${note.path}_\n\n${note.content}`) : text("Nota não encontrada.", true);
        }),
    );
  }

  if (can("status")) {
    server.registerTool(
      "pendencias_github",
      { title: "PRs e propostas pendentes", description: "Lê PRs abertos e propostas sem decisão nos repositórios visíveis ao token da Órbita. Não aprova nem altera nada.", inputSchema: {} },
      async () => run("pendencias_github", "consultou PRs e propostas", async () => {
        const inbox = await githubInbox();
        if (!inbox.configured) return text("GitHub não configurado na Órbita.", true);
        if (inbox.error) return text(inbox.error, true);
        return text([`Organização: ${inbox.org}. ${inbox.items.length} de ${inbox.total} resultados${inbox.truncated ? " (consulta parcial)" : ""}.`, inbox.warning, ...inbox.items.map((item) => `- ${item.kind === "pr" ? item.draft ? "PR rascunho" : "PR" : "Proposta"}: ${item.repo} #${item.number} — ${item.title}\n  ${item.url}`)].join("\n"));
      }),
    );
    server.registerTool(
      "automacoes_operacionais",
      { title: "Automações e falhas", description: "Lê workflows ativos/inativos e falhas recentes das instâncias n8n conectadas. Não executa nem modifica workflows.", inputSchema: {} },
      async () => run("automacoes_operacionais", "consultou automações e falhas", async () => {
        const overview = await n8nOverview();
        if (!overview.configured) return text("Instâncias n8n não configuradas na Órbita (N8N_INSTANCES).", true);
        return text(overview.instances.map((instance) => instance.ok
          ? `${instance.name}: ${instance.workflows.filter((workflow) => workflow.active).length}/${instance.workflows.length} workflows ativos. ${instance.errors.length} falhas recentes.\n${instance.errors.slice(0, 10).map((error) => `- ${error.workflowName} · ${error.startedAt} · ${error.url}`).join("\n")}`
          : `${instance.name}: não foi possível consultar a instância.`).join("\n\n"));
      }),
    );
    server.registerTool(
      "status_ao_vivo",
      { title: "Status ao vivo", description: "Endereços fora do ar, incidentes abertos, domínios perto de vencer e saúde dos monitores.", inputSchema: {} },
      async () =>
        run("status_ao_vivo", "consultou o status ao vivo", async () => {
          const live = await liveOps();
          const down = live.status.filter((s) => !s.ok);
          const lines = [
            `Endereços: ${live.status.length - down.length}/${live.status.length} no ar.`,
            ...down.map((d) => `- ❌ ${d.name} (${d.url}) desde ${d.changedAt.toISOString()} — ${d.statusCode ?? d.error ?? ""}`),
            `Incidentes abertos: ${live.events.filter((e) => e.kind === "site_down" && !e.resolvedAt).length}`,
            `Monitores: ${live.monitors.map((m) => `${m.label} ${m.silent ? "⚠️ em silêncio" : "ok"} (última batida ${m.lastSeen.toISOString()})`).join("; ") || "nenhum"}`,
            `Domínios < 45 dias: ${live.domains.filter((d) => d.expiresAt && d.expiresAt.getTime() - Date.now() < 45 * 86_400_000).map((d) => `${d.domain} (${d.expiresAt!.toISOString().slice(0, 10)})`).join(", ") || "nenhum"}`,
          ];
          return text(lines.join("\n"));
        }),
    );
  }

  if (can("tarefas")) {
    server.registerTool(
      "criar_tarefa_para_antonio",
      { title: "Criar tarefa para Antonio", description: "Abre uma tarefa na Órbita para Antonio decidir ou executar (aprovação, pendência, próximo passo). Use para o que depende dele.", inputSchema: { titulo: z.string().min(3).max(200), detalhes: z.string().max(4000).optional(), prioridade: z.enum(["baixa", "media", "alta"]).optional(), prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("AAAA-MM-DD") } },
      async ({ titulo, detalhes, prioridade, prazo }) =>
        run("criar_tarefa_para_antonio", `abriu tarefa “${titulo}”`, async () => {
          const db = await getDb();
          const [t] = await db
            .insert(tasks)
            .values({ title: titulo, notes: `${detalhes ?? ""}\n\n— aberta por ${agent.name} via MCP`.trim(), priority: prioridade === "alta" ? 3 : prioridade === "media" ? 2 : prioridade === "baixa" ? 1 : 0, dueDate: prazo ?? null, tags: ["agente", `agente:${slug(agent.name)}`], scope: "empresa" })
            .returning({ id: tasks.id });
          const notified = await notifyAgentAsk(agent.name, titulo, prioridade ?? null);
          return text(`Tarefa criada (${t.id}). Antonio verá na Órbita.${notified ? " O Telegram aceitou o aviso (entrega não confirmada)." : " Aviso no Telegram não confirmado; a tarefa continua salva."}`);
        }),
    );
    server.registerTool(
      "minhas_tarefas",
      { title: "Minhas tarefas abertas para Antonio", description: "Lista as tarefas que este agente abriu e se já foram concluídas.", inputSchema: {} },
      async () =>
        run("minhas_tarefas", "consultou suas tarefas", async () => {
          const list = await agentTasks(agent.name);
          return text(list.length ? list.map((t) => `- [${t.status === "done" ? "x" : " "}] ${t.title} (${t.id})${t.dueDate ? ` · prazo ${t.dueDate}` : ""}`).join("\n") : "Nenhuma tarefa aberta por você.");
        }),
    );
  }

  if (can("eventos")) {
    server.registerTool(
      "registrar_evento",
      { title: "Registrar evento operacional", description: "Registra na linha do tempo da Operação algo que aconteceu (deploy, manutenção, incidente, alerta). Não use para conversas.", inputSchema: { tipo: z.enum(["info", "alerta", "incidente"]), assunto: z.string().min(3).max(200), detalhe: z.string().max(2000).optional() } },
      async ({ tipo, assunto, detalhe }) =>
        run("registrar_evento", `registrou ${tipo}: ${assunto}`, async () => {
          const db = await getDb();
          await db.insert(opsEvents).values({ kind: `agente_${tipo}`, severity: tipo === "incidente" ? "critical" : tipo === "alerta" ? "warning" : "info", source: `agente:${slug(agent.name)}`, subject: assunto, detail: { message: detalhe ?? "", agent: agent.name } });
          return text("Evento registrado na Operação.");
        }),
    );
  }

  return server;
}
