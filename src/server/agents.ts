import { fullAgentManualMarkdown } from "@/server/agent-catalog";
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
import { stageLabel } from "@/lib/github-triage";
import { n8nOverview } from "./ops";
import { getVaultIndexSafe, vaultHealth } from "./vault";
import { assistantTools, runAssistantTool } from "./assistant";
import { TARGET_LABEL, isSilent, listDispatches, reportDispatchResult, resultInput } from "./dispatch";
import { DISPATCH_TARGETS } from "@/db/schema";
import { AGENT_MANUAL_URI, AGENT_MANUAL_VERSION } from "@/lib/agent-handbook";
import { searchKnowledge } from "./tool-search";
import { assigneeLabel, isStale } from "@/lib/task-assignee";
import { claimMessage, claimTask, companyQueue, releaseTask, splitInput, splitTask } from "./task-claim";

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

export async function updateAgentScopes(id: string, scopes: AgentScope[]) {
  const db = await getDb();
  await db.update(agentTokens).set({ scopes }).where(and(eq(agentTokens.id, id), eq(agentTokens.revoked, false)));
}

export type AgentIdentity = { id: string; name: string; scopes: AgentScope[] };

/** Valida o Bearer de um agente (tokens revogados não passam). */
export async function verifyAgentToken(bearer: string | null | undefined): Promise<AgentIdentity | null> {
  if (bearer?.startsWith("orb_oauth_")) {
    const { verifyOAuthAccess } = await import("./mcp-oauth");
    return verifyOAuthAccess(bearer);
  }
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

/** Chamadas por agente e dia (fuso de São Paulo) na janela informada. Filtre pelo agente no chamador. */
export async function agentActivityByDay(days = 14) {
  const db = await getDb();
  const since = new Date(Date.now() - days * 86_400_000);
  const day = sql<string>`to_char(${agentActivity.createdAt} at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`;
  return db.select({
    agent: agentActivity.agent,
    day,
    calls: sql<number>`count(*)`.mapWith(Number),
    failures: sql<number>`count(*) filter (where not ${agentActivity.ok})`.mapWith(Number),
  }).from(agentActivity).where(gte(agentActivity.createdAt, since)).groupBy(agentActivity.agent, day);
}

/** Tarefas que os agentes abriram para Antonio (tag "agente:<nome>"). */
export async function agentTasks(agent?: string) {
  const db = await getDb();
  const cond = agent ? sql`(${`agente:${slug(agent)}`} = any(${tasks.tags}) or ${tasks.assignee} = ${agent})` : sql`exists (select 1 from unnest(${tasks.tags}) t where t like 'agente:%')`;
  return db.select().from(tasks).where(and(eq(tasks.scope, "empresa"), cond)).orderBy(sql`case when ${tasks.status} = 'done' then 1 else 0 end`, sql`case when 'resposta:antonio' = any(${tasks.tags}) then 0 else 1 end`, desc(tasks.createdAt)).limit(100);
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
  const server = new McpServer({ name: "orbita", version: "2.0.0" }, { instructions: `Órbita: central pessoal e empresarial. Comece por documentacao ou pelo resource ${AGENT_MANUAL_URI} (versão ${AGENT_MANUAL_VERSION}); depois contexto_operacional com ao_vivo:false e as fichas relevantes do vault. Pessoal e Empresa permanecem separados; tarefas comerciais pertencem ao CRM. Administradores acessam também dados pessoais e escrita; demais perfis usam apenas seus escopos. Conexão MCP não despacha execuções aos runtimes. Registre resultado verificável e fonte, sem confundir configuração com execução.` });
  const can = (s: AgentScope) => agent.scopes.includes("admin") || agent.scopes.includes(s);
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

  // O contrato de uso não contém dados do proprietário e pode ser lido por todo token válido.
  server.registerResource("manual-orbita", AGENT_MANUAL_URI, { title: "Manual canônico da Órbita", description: "Fontes, escopos, integração e continuidade do ecossistema", mimeType: "text/markdown" }, async () => ({ contents: [{ uri: AGENT_MANUAL_URI, mimeType: "text/markdown", text: fullAgentManualMarkdown() }] }));
  server.registerTool("documentacao", { title: "Manual canônico", description: "Leia primeiro: contrato atual da central, fontes, Pessoal/Empresa, escopos e roteiro do agente.", inputSchema: {}, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } }, async () => run("documentacao", "leu o manual canônico", async () => text(fullAgentManualMarkdown())));
  server.registerPrompt("iniciar_operacao", { title: "Entrar na Órbita", description: "Roteiro para situar o agente antes de consultar ou executar" }, async () => ({ messages: [{ role: "user", content: { type: "text", text: `${fullAgentManualMarkdown()}\n\nConsulte tools/list para suas permissões e contexto_operacional com ao_vivo:false se disponível. Leia as fichas relevantes e prossiga dentro da tarefa autorizada pelo proprietário.` } }] }));

  if (can("contexto")) {
    server.registerTool(
      "contexto_operacional",
      { title: "Contexto operacional", description: "Regras do vault, agentes, servidores, aplicações, automações e monitoramento. Padrão: inventário; solicite ao_vivo para a decisão atual.", inputSchema: { ao_vivo: z.boolean().optional().describe("Incluir estado ao vivo (status, incidentes, monitores)") }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } },
      async ({ ao_vivo }) => run("contexto_operacional", "leu o contexto operacional", async () => text(contextToMarkdown(await buildContext({ live: ao_vivo ?? false })))),
    );
    server.registerTool(
      "buscar",
      { title: "Buscar", description: "Busca no manual e vault; administradores também consultam tarefas, projetos e notas do espaço escolhido. Até 8 resultados por fonte; CRM e estado ao vivo têm consultas próprias.", inputSchema: { consulta: z.string().trim().min(2).max(200), fonte: (can("admin") ? z.enum(["todos", "documentacao", "vault", "tarefas", "projetos", "notas"]) : z.enum(["todos", "documentacao", "vault"])).optional(), ...(can("admin") ? { escopo: z.enum(["pessoal", "empresa"]).optional() } : {}) }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } },
      async ({ consulta, fonte, escopo }) => run("buscar", "consultou a busca", async () => text(JSON.stringify(await searchKnowledge(consulta, { internal: can("admin"), scope: escopo, source: fonte })))),
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
          return note ? text(`# ${note.title}\n_caminho: ${note.path}_\n_versão: ${note.sha}_\n\n${note.content}`) : text("Nota não encontrada.", true);
        }),
    );
  }

  if (can("status")) {
    server.registerTool(
      "pendencias_github",
      { title: "PRs e propostas pendentes", description: "Lê PRs e a fila GitHub separando execução, decisão de Antonio e itens a classificar. Não aprova, executa, mescla nem altera nada.", inputSchema: {} },
      async () => run("pendencias_github", "consultou PRs e propostas", async () => {
        const inbox = await githubInbox();
        if (!inbox.configured) return text("GitHub não configurado na Órbita.", true);
        if (inbox.error) return text(inbox.error, true);
        return text([`Organização: ${inbox.org}. ${inbox.items.length} de ${inbox.total} resultados${inbox.truncated ? " (consulta parcial)" : ""}.`, inbox.warning, ...inbox.items.map((item) => `- ${stageLabel(item)}: ${item.repo} #${item.number} — ${item.title}\n  ${item.url}`)].join("\n"));
      }),
    );
    server.registerTool(
      "automacoes_operacionais",
      { title: "Automações e falhas", description: "Lê workflows ativos/inativos e falhas recentes das instâncias n8n conectadas. Não executa nem modifica workflows.", inputSchema: {} },
      async () => run("automacoes_operacionais", "consultou automações e falhas", async () => {
        const overview = await n8nOverview();
        if (!overview.configured) return text("Instâncias n8n não configuradas na Órbita (N8N_INSTANCES).", true);
        return text(overview.instances.map((instance) => instance.ok
          ? `${instance.name}: ${instance.workflows.filter((workflow) => workflow.active).length}/${instance.workflows.length} workflows ativos${instance.workflowsPartial ? " na amostra; inventário incompleto" : ""}. ${instance.errors.length} falhas recentes retornadas (limite 25).\n${instance.errors.slice(0, 10).map((error) => `- ${error.workflowName} · ${error.startedAt} · ${error.url}`).join("\n")}`
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
            `Incidentes abertos (amostra): ${live.events.filter((e) => e.severity !== "info" && !e.resolvedAt).length}`,
            `Monitores: ${live.monitors.map((m) => `${m.label} ${m.silent ? "⚠️ em silêncio" : "ok"} (última batida ${m.lastSeen.toISOString()})`).join("; ") || "nenhum"}`,
            `Domínios < 45 dias: ${live.domains.filter((d) => d.expiresAt && d.expiresAt.getTime() - Date.now() < 45 * 86_400_000).map((d) => `${d.domain} (${d.expiresAt!.toISOString().slice(0, 10)})`).join(", ") || "nenhum"}`,
          ];
          return text(lines.join("\n"));
        }),
    );
    server.registerTool(
      "eventos_recentes",
      { title: "Eventos recentes", description: "Lê os eventos da Operação: quedas, falhas de workflow, alertas de domínio e relatos dos agentes. Use para conferir o que você mesmo registrou ou o que outro diretor relatou.", inputSchema: { horas: z.number().int().min(1).max(168).optional().describe("Janela em horas (padrão 24)"), origem: z.string().max(80).optional().describe("Prefixo da origem, ex.: agente:tom, n8n"), tipo: z.string().max(40).optional().describe("Tipo exato, ex.: workflow_error, agente_resumo") }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
      async ({ horas, origem, tipo }) =>
        run("eventos_recentes", `consultou eventos (${horas ?? 24}h)`, async () => {
          const db = await getDb();
          const since = new Date(Date.now() - (horas ?? 24) * 3_600_000);
          const rows = await db.select().from(opsEvents).where(and(gte(opsEvents.createdAt, since), origem ? sql`${opsEvents.source} like ${`${origem.replace(/[%_\\]/g, "\\$&")}%`}` : undefined, tipo ? eq(opsEvents.kind, tipo) : undefined)).orderBy(desc(opsEvents.createdAt)).limit(50);
          if (!rows.length) return text(`Nenhum evento nas últimas ${horas ?? 24}h com esse filtro.`);
          return text(rows.map((e) => `- ${e.createdAt.toISOString()} · ${e.kind} · ${e.severity} · ${e.source}${e.resolvedAt ? " · resolvido" : ""}\n  ${e.subject}${typeof e.detail?.message === "string" && e.detail.message ? ` — ${e.detail.message.slice(0, 300)}` : ""} (${e.id})`).join("\n"));
        }),
    );
  }

  if (can("tarefas")) {
    server.registerTool(
      "criar_tarefa_para_antonio",
      { title: "Criar tarefa para Antonio", description: "Abre uma tarefa na Órbita para Antonio decidir ou executar (aprovação, pendência, próximo passo). Use para o que depende dele.", inputSchema: { titulo: z.string().min(3).max(200), detalhes: z.string().max(4000).optional(), prioridade: z.enum(["baixa", "media", "alta"]).optional(), prazo: z.iso.date().optional().describe("AAAA-MM-DD"), negocio: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(40).optional().describe("Identificador explícito do negócio, ex.: barberias. Sem vínculo, omita.") } },
      async ({ titulo, detalhes, prioridade, prazo, negocio }) =>
        run("criar_tarefa_para_antonio", `abriu tarefa “${titulo}”`, async () => {
          const db = await getDb();
          const [t] = await db
            .insert(tasks)
            .values({ title: titulo, notes: `${detalhes ?? ""}\n\n— aberta por ${agent.name} via MCP`.trim(), priority: prioridade === "alta" ? 3 : prioridade === "media" ? 2 : prioridade === "baixa" ? 1 : 0, dueDate: prazo ?? null, tags: ["agente", `agente:${slug(agent.name)}`, ...(negocio ? [negocio] : [])], scope: "empresa" })
            .returning({ id: tasks.id });
          const notified = await notifyAgentAsk(agent.name, titulo, prioridade ?? null);
          return text(`Tarefa criada (${t.id}). Antonio verá em /tarefas?escopo=empresa.${notified ? " O Telegram aceitou o aviso (entrega não confirmada)." : " Aviso no Telegram não confirmado; a tarefa continua salva."}`);
        }),
    );
    server.registerTool(
      "consultar_minha_tarefa",
      {
        title: "Consultar minha tarefa por UUID",
        description: "Readback estruturado exato de tarefa Empresa atribuída ao agente autenticado. Sem limite de listagem, notas ou bypass de administrador.",
        inputSchema: z.object({ id: z.uuid() }).strict(),
        outputSchema: z.object({ id: z.uuid(), status: z.string(), assignee: z.string(), scope: z.literal("empresa") }).strict(),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async ({ id }) => run("consultar_minha_tarefa", `consultou tarefa ${id}`, async () => {
        const db = await getDb();
        const [task] = await db.select({ id: tasks.id, status: tasks.status, assignee: tasks.assignee, scope: tasks.scope })
          .from(tasks).where(and(eq(tasks.id, id), eq(tasks.scope, "empresa"), eq(tasks.assignee, agent.name)));
        if (!task) return text("Tarefa atribuída não encontrada.", true);
        return { ...text(JSON.stringify(task)), structuredContent: task };
      }),
    );
    server.registerTool(
      "minhas_tarefas",
      { title: "Minhas tarefas e respostas", description: "Lista pedidos deste agente e tarefas atribuídas a ele, incluindo as respostas de Antonio nas notas. Retornos continuam pendentes até o agente executar e registrar o resultado.", inputSchema: {} },
      async () =>
        run("minhas_tarefas", "consultou suas tarefas", async () => {
          const list = await agentTasks(agent.name);
          return text(list.length ? list.map((t) => `- [${t.status === "done" ? "x" : " "}] ${t.title} (${t.id}) · ${t.status}${t.assignee ? ` · responsável ${t.assignee}` : ""}${t.dueDate ? ` · prazo ${t.dueDate}` : ""}${t.notes ? `\n${t.notes.slice(-6000)}` : ""}`).join("\n\n") : "Nenhuma tarefa vinculada a você.");
        }),
    );
    server.registerTool(
      "atualizar_minha_tarefa",
      { title: "Registrar andamento da minha tarefa", description: "Inicia ou conclui tarefa empresarial atribuída a este agente, com resumo/evidência. No resumo, descreva o estado concreto: o que já existe, o que você fez nesta etapa (com evidência) e o que falta. Reutilize registro_id (UUID) ao repetir o mesmo envio. Não altera tarefas pessoais ou de outro agente.", inputSchema: { id: z.uuid(), registro_id: z.uuid(), estado: z.enum(["doing", "done"]), resumo: z.string().trim().min(3).max(2000).refine(v => !v.includes("<!-- orbita-")) } },
      async ({ id, registro_id, estado, resumo }) => run("atualizar_minha_tarefa", `registrou andamento ${estado}`, async () => {
        const db = await getDb();
        const marker = `<!-- orbita-progress:${registro_id} -->`;
        const block = `\n\n---\n${agent.name} · ${new Date().toISOString()} · ${estado}\n${resumo}\n${marker}`;
        // Atribuída ao agente pela tag do pedido ou assumida por ele; nunca a tarefa que outro responsável assumiu.
        const own = and(eq(tasks.id, id), eq(tasks.scope, "empresa"), sql`((${`agente:${slug(agent.name)}`} = any(${tasks.tags}) and (${tasks.assignee} is null or ${tasks.assignee} = ${agent.name})) or ${tasks.assignee} = ${agent.name})`);
        const [updated] = await db.update(tasks).set({ status: estado, completedAt: estado === "done" ? new Date() : null, assignee: agent.name, claimedAt: sql`case when ${tasks.assignee} = ${agent.name} then coalesce(${tasks.claimedAt}, now()) else now() end`, notes: sql`coalesce(${tasks.notes}, '') || ${block}` })
          .where(and(own, sql`position(${marker} in coalesce(${tasks.notes}, '')) = 0`, sql`length(coalesce(${tasks.notes}, '')) + length(${block}) <= 64000`)).returning({ id: tasks.id });
        if (updated) {
          const [part] = estado === "done" ? await db.select({ parentId: tasks.parentId }).from(tasks).where(eq(tasks.id, updated.id)) : [];
          if (part?.parentId) {
            const [left] = await db.select({ open: sql<number>`count(*) filter (where ${tasks.status} <> 'done')::int`, title: sql<string>`(select title from ${tasks} p where p.id = ${part.parentId})` }).from(tasks).where(eq(tasks.parentId, part.parentId));
            if (left && left.open === 0) return text(`Parte ${updated.id} concluída. Todas as partes de “${left.title}” estão concluídas: assuma a tarefa principal (${part.parentId}) e registre o fechamento com a evidência consolidada.`);
          }
          return text(`Tarefa ${updated.id} atualizada para ${estado}. Resultado registrado na Órbita.`);
        }
        const [existing] = await db.select({ notes: tasks.notes }).from(tasks).where(own);
        return text(existing?.notes?.includes(marker) ? "Este registro de andamento já foi salvo." : "Tarefa indisponível para este agente ou histórico no limite.");
      }),
    );
    server.registerTool(
      "fila_empresa",
      { title: "Fila de execução da Empresa", description: "Lista as tarefas internas abertas da Empresa com responsável e status: primeiro as livres (por prioridade), depois as já assumidas. Use antes de assumir_tarefa para escolher trabalho sem colidir com outro agente.", inputSchema: { somente_livres: z.boolean().optional().describe("true mostra apenas tarefas sem responsável") }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
      async ({ somente_livres }) =>
        run("fila_empresa", "consultou a fila da Empresa", async () => {
          const rows = (await companyQueue()).filter((t) => !somente_livres || (!t.assignee && t.parts.total === 0));
          if (!rows.length) return text(somente_livres ? "Nenhuma tarefa livre na fila da Empresa." : "Fila da Empresa vazia.");
          const prio = ["", "baixa", "média", "alta"];
          return text(rows.map((t) => `- ${t.parentTitle ? `[parte de “${t.parentTitle}”] ` : ""}${t.title} (${t.id}) · ${t.assignee ? assigneeLabel(t) : t.parts.total ? `dividida: ${t.parts.done}/${t.parts.total} partes concluídas` : "livre"}${isStale(t) ? " · sem atualização de responsável há mais de 48 h" : ""}${t.priority ? ` · prioridade ${prio[t.priority]}` : ""}${t.dueDate ? ` · prazo ${t.dueDate}` : ""}${t.tags.length ? ` · #${t.tags.join(" #")}` : ""}${t.notes ? `\n  ${t.notes.replace(/\s+/g, " ").slice(0, 280)}` : ""}`).join("\n"));
        }),
    );
    server.registerTool(
      "assumir_tarefa",
      { title: "Assumir tarefa da Empresa", description: "Reserva uma tarefa interna da Empresa (ou uma parte de tarefa dividida) para este agente e a coloca em andamento. Falha se outro responsável já a assumiu; repetir com o mesmo agente é seguro. Quem assume continua até concluir; assuma uma por vez. Se for grande demais para concluir nesta sessão, use dividir_tarefa em vez de assumir.", inputSchema: { id: z.uuid(), plano: z.string().trim().min(3).max(1000).refine(v => !v.includes("<!-- orbita-")).optional().describe("Primeiro passo ou abordagem, registrado no histórico") }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
      async ({ id, plano }) =>
        run("assumir_tarefa", `assumiu a tarefa ${id}`, async () => {
          const r = await claimTask(id, agent.name, plano);
          return text(claimMessage(r, "assumir"), !r.ok);
        }),
    );
    server.registerTool(
      "liberar_tarefa",
      { title: "Liberar tarefa assumida", description: "Exceção, não rotina: devolve à fila (a fazer, sem responsável) uma tarefa assumida que travou por erro, bloqueio externo ou falta de acesso, ou cuja prioridade Antonio mudou. Explique o motivo e o ponto exato em que parou. Tarefa grande demais se divide com dividir_tarefa, não se libera.", inputSchema: { id: z.uuid(), motivo: z.string().trim().min(3).max(2000).refine(v => !v.includes("<!-- orbita-")) }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } },
      async ({ id, motivo }) =>
        run("liberar_tarefa", `liberou a tarefa ${id}`, async () => {
          const r = await releaseTask(id, agent.name, motivo);
          return text(claimMessage(r, "liberar"), !r.ok);
        }),
    );
    server.registerTool(
      "dividir_tarefa",
      { title: "Dividir tarefa grande em partes", description: "Quebra uma tarefa principal da Empresa grande demais para uma sessão em 2 a 12 partes específicas, que cada agente assume e conclui separadamente. Cada parte precisa de um título de ação concreta (verbo + objeto, ex.: “Members: ativar métricas no CRM e comparar com o admin”) e de pronto_quando verificável. Evite partes genéricas como “inventário”, “melhorias” ou “revisar”. A principal fica livre e acompanha o progresso. Reutilize registro_id ao repetir.", inputSchema: { id: z.uuid(), registro_id: z.uuid(), motivo: splitInput.shape.motivo, partes: splitInput.shape.partes }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
      async ({ id, registro_id, motivo, partes }) =>
        run("dividir_tarefa", `dividiu a tarefa ${id} em ${partes.length} partes`, async () => {
          const r = await splitTask(id, agent.name, registro_id, { motivo, partes });
          if (!r.ok) return text(r.message, true);
          const list = r.parts.map((p) => `- ${p.title} (${p.id})`).join("\n");
          return text(`${r.repeated ? "Divisão já registrada" : `Tarefa dividida em ${r.parts.length} partes`}:\n${list}\nAssuma uma parte com assumir_tarefa e leve-a até o fim.`);
        }),
    );
  }

  if (can("eventos")) {
    server.registerTool(
      "registrar_evento",
      { title: "Registrar evento operacional", description: "Registra deploy, manutenção, incidente ou resumo diário. Use tipo resumo para triagem e entregas que devem entrar no bom dia; informe assunto e detalhe objetivo, sem dados sensíveis de clientes. Não use para conversas.", inputSchema: { tipo: z.enum(["info", "alerta", "incidente", "resumo"]), assunto: z.string().min(3).max(200), detalhe: z.string().max(2000).optional() } },
      async ({ tipo, assunto, detalhe }) =>
        run("registrar_evento", `registrou ${tipo}: ${assunto}`, async () => {
          const db = await getDb();
          await db.insert(opsEvents).values({ kind: `agente_${tipo}`, severity: tipo === "incidente" ? "critical" : tipo === "alerta" ? "warning" : "info", source: `agente:${slug(agent.name)}`, subject: assunto, detail: { message: detalhe ?? "", agent: agent.name } });
          return text("Evento registrado na Operação.");
        }),
    );
    server.registerTool(
      "pedidos_recebidos",
      { title: "Pedidos da Órbita em aberto", description: "Lista pedidos que a Órbita enviou a um diretor e que ainda esperam execução ou resultado. Use se o webhook não chegou ou para retomar um pedido.", inputSchema: { destino: z.enum(DISPATCH_TARGETS).optional() }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
      async ({ destino }) =>
        run("pedidos_recebidos", "consultou pedidos em aberto", async () => {
          const rows = await listDispatches({ target: destino, open: true, limit: 20 });
          if (!rows.length) return text("Nenhum pedido em aberto.");
          return text(rows.map((d) => `- ${d.id} · ${TARGET_LABEL[d.target]} · ${d.action} · ${d.status}${isSilent(d) ? " (sem retorno)" : ""} · ${d.createdAt.toISOString()}\n  parâmetros: ${JSON.stringify(d.params).slice(0, 600)}`).join("\n"));
        }),
    );
    server.registerTool(
      "registrar_resultado",
      { title: "Registrar resultado de pedido", description: "Informa à Órbita a execução de um pedido recebido: em_execucao ao começar; concluido ou falhou ao terminar, com resumo objetivo e evidência (comando, arquivo, PR ou link). Sem segredos ou dados pessoais de clientes.", inputSchema: resultInput.shape, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
      async (args) =>
        run("registrar_resultado", `informou ${args.estado} do pedido ${args.pedido_id}`, async () => {
          const result = await reportDispatchResult(agent.name, args);
          return text(result.message, !result.ok);
        }),
    );
  }

  if (can("admin")) {
    server.registerTool("diagnostico_integracoes", {
      title: "Diagnóstico interno das integrações", description: "Administrador: sondagens de leitura das dependências da Órbita e coleta dos negócios. Distingue configuração, resposta, ausência e desatualização. Não envia mensagens, não executa workflows ou agentes e não altera credenciais.", inputSchema: {}, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async () => run("diagnostico_integracoes", "consultou o diagnóstico interno", async () => {
      const { checkIntegrationHealth } = await import("./integrations");
      return text(JSON.stringify({ checkedAt: new Date().toISOString(), items: await checkIntegrationHealth() }));
    }));
    server.registerTool("contexto_pessoal", { description: "Administrador: contexto atual de tarefas, hábitos, agenda, metas e saúde do proprietário.", inputSchema: {} }, async () => run("contexto_pessoal", "consultou o contexto pessoal", async () => {
      const { personalContext } = await import("./ai");
      return text(await personalContext());
    }));
    for (const tool of assistantTools().filter((t) => !t.orbeOnly && t.name !== "buscar")) {
      server.registerTool(`orbita_${tool.name}`, {
        title: tool.name,
        description: `Administrador: ${tool.description}`,
        inputSchema: tool.schema,
        ...(tool.readOnly ? { annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } } : {}),
      }, async (args) => run(`orbita_${tool.name}`, `executou ${tool.name}`, async () => {
        const result = await runAssistantTool(tool.name, args);
        return text(result.text, !result.ok);
      }));
    }
  }
  return server;
}
