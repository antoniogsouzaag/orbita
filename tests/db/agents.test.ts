import { beforeAll, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/mcp/route";
import { getDb } from "@/db";
import { agentActivity, agentTokens, opsEvents, opsStatus, tasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ingest, IngestSchema } from "@/server/ops-live";
import { agentActivitySummary, createAgentToken, listAgentTokens, revokeAgentToken, verifyAgentToken, updateAgentScopes } from "@/server/agents";
import { buildContext, contextToMarkdown } from "@/server/context";

let n = 0;
async function rpc(token: string | null, method: string, params: object = {}) {
  const res = await POST(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++n, method, params }),
    }),
  );
  return { status: res.status, body: (await res.json()) as { result?: Record<string, unknown>; error?: { message: string } } };
}

const init = (t: string) => rpc(t, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "teste", version: "1" } });
const toolNames = async (t: string) => ((await rpc(t, "tools/list")).body.result!.tools as { name: string }[]).map((x) => x.name).sort();

describe("central dos agentes (MCP)", () => {
  beforeAll(async () => {
    const db = await getDb();
    await db.delete(agentActivity);
    await db.delete(agentTokens);
    await db.delete(tasks);
    await db.delete(opsEvents);
  });

  it("guarda só o hash e recusa token inválido ou revogado", async () => {
    const token = await createAgentToken("Teste", ["status"]);
    expect(token).toMatch(/^orb_[A-Za-z0-9_-]{32}$/);
    const [row] = await listAgentTokens();
    expect(row.tokenHash).not.toContain(token);
    expect(row.prefix).toBe(token.slice(0, 10));
    expect(await verifyAgentToken(token)).toMatchObject({ name: "Teste", scopes: ["status"] });
    expect(await verifyAgentToken(`${token}x`)).toBeNull();
    expect(await verifyAgentToken(null)).toBeNull();

    expect((await rpc(null, "tools/list")).status).toBe(401);
    expect((await rpc("orb_inexistente_123456789", "tools/list")).status).toBe(401);

    await revokeAgentToken(row.id);
    expect(await verifyAgentToken(token)).toBeNull();
    expect((await rpc(token, "tools/list")).status).toBe(401);
  });

  it("expõe só as ferramentas dos escopos do agente", async () => {
    const t = await createAgentToken("Só leitura", ["status"]);
    expect((await init(t)).body.result).toMatchObject({ serverInfo: { name: "orbita" } });
    expect(await toolNames(t)).toEqual(["automacoes_operacionais", "consultar_jornal", "documentacao", "eventos_recentes", "pendencias_github", "status_ao_vivo"]);
    const call = await rpc(t, "tools/call", { name: "criar_tarefa_para_antonio", arguments: { titulo: "não deveria" } });
    expect(JSON.stringify(call.body)).toMatch(/not found|não|error/i);
  });

  it("não apresenta a última resposta antiga como disponibilidade atual ao agente", async () => {
    const url = "https://monitor-expirado.example/";
    await ingest(IngestSchema.parse({ source: "teste-status-expirado", everyMinutes: 15, links: [{ url, name: "Monitor antigo", status: 200 }] }));
    const db = await getDb();
    await db.update(opsStatus).set({ checkedAt: new Date(Date.now() - 60 * 60_000) }).where(eq(opsStatus.url, url));
    const token = await createAgentToken("Status teste", ["status"]);
    const result = await rpc(token, "tools/call", { name: "status_ao_vivo", arguments: {} });
    const output = JSON.stringify(result.body);
    expect(output).toContain("sem verificação recente");
    expect(output).toContain("Monitor antigo");
    expect(output).not.toContain("1/1 no ar com verificação recente");
    await db.delete(opsStatus).where(eq(opsStatus.url, url));
  });

  it("informa as mesmas categorias e recorte nas ferramentas e no contexto", async () => {
    const db = await getDb();
    await db.delete(opsEvents);
    const now = new Date();
    await db.insert(opsEvents).values([
      { kind: "site_down", severity: "critical", source: "fixture", subject: "Queda aberta" },
      { kind: "site_down", severity: "critical", source: "fixture", subject: "Queda resolvida", resolvedAt: now },
      { kind: "workflow_error", severity: "warning", source: "fixture", subject: "Falha aberta" },
      { kind: "workflow_error", severity: "warning", source: "fixture", subject: "Falha resolvida", resolvedAt: now },
      { kind: "agente_alerta", severity: "warning", source: "fixture", subject: "Relato de agente" },
      { kind: "agente_resumo", severity: "info", source: "fixture", subject: "Resumo" },
    ]);
    const token = await createAgentToken("Status categorias", ["admin"]);
    const regular = await rpc(token, "tools/call", { name: "status_ao_vivo", arguments: {} });
    const admin = await rpc(token, "tools/call", { name: "orbita_status_operacao", arguments: {} });
    const context = contextToMarkdown(await buildContext({ live: true }));
    for (const output of [JSON.stringify(regular.body), JSON.stringify(admin.body), context]) {
      expect(output).toContain("Quedas de sites não resolvidas na amostra: 1");
      expect(output).toContain("2 nas últimas 24h; 1 sem resolução registrada");
      expect(output).toContain("Outros alertas ou relatos de agentes não resolvidos na amostra: 1");
      expect(output).toContain("não representa o histórico completo");
      expect(output).toContain("Relato de agente");
    }
    await db.delete(opsEvents).where(eq(opsEvents.source, "fixture"));
  });

  it("entrega o mesmo manual por ferramenta, resource e prompt sem ampliar permissões", async () => {
    const token = await createAgentToken("Manual", ["status"]);
    const resources = await rpc(token, "resources/list");
    expect(resources.body.result!.resources).toEqual(expect.arrayContaining([expect.objectContaining({ uri: "orbita://manual", mimeType: "text/markdown" })]));
    const resource = await rpc(token, "resources/read", { uri: "orbita://manual" });
    const manual = await rpc(token, "tools/call", { name: "documentacao", arguments: {} });
    const resourceText = (resource.body.result!.contents as { text: string }[])[0].text;
    const toolText = (manual.body.result!.content as { text: string }[])[0].text;
    expect(resourceText).toBe(toolText);
    expect(toolText).toContain("Pessoal e Empresa são espaços separados");
    expect(toolText).toContain("CRM");
    const prompts = await rpc(token, "prompts/list");
    expect(prompts.body.result!.prompts).toEqual(expect.arrayContaining([expect.objectContaining({ name: "iniciar_operacao" })]));
    const prompt = await rpc(token, "prompts/get", { name: "iniciar_operacao" });
    expect(JSON.stringify(prompt.body.result)).toContain("ao_vivo:false");
    expect(await toolNames(token)).not.toContain("contexto_pessoal");
  });

  it("anuncia nomes simples e protege as fontes internas da busca", async () => {
    const token = await createAgentToken("Busca contexto", ["contexto"]);
    const names = await toolNames(token);
    expect(names).toContain("buscar");
    expect(names).not.toContain("buscar_no_vault");
    const denied = await rpc(token, "tools/call", { name: "buscar", arguments: { consulta: "teste", fonte: "tarefas" } });
    expect(denied.body.result).toMatchObject({ isError: true });
    const admin = await createAgentToken("Busca admin", ["admin"]);
    const adminNames = await toolNames(admin);
    expect(adminNames).toContain("buscar");
    expect(adminNames).not.toContain("orbita_buscar");
    expect(adminNames).toContain("orbita_listar_metas");
    expect(adminNames).toContain("orbita_consultar_tarefa");
    expect(adminNames).toContain("orbita_consultar_nota");
    expect(adminNames).toContain("orbita_vincular_nota_projeto");
    expect(names).not.toContain("orbita_consultar_nota");
    expect(names).not.toContain("orbita_vincular_nota_projeto");
    expect(names).not.toContain("orbita_consultar_tarefa");
    expect(adminNames).toContain("diagnostico_integracoes");
    expect(names).not.toContain("diagnostico_integracoes");
    const restricted = await rpc(token, "tools/call", { name: "diagnostico_integracoes", arguments: {} });
    expect(JSON.stringify(restricted.body)).toMatch(/not found|error/i);
  });

  it("leitura completa de notas exige admin; grant tarefas não acessa a ferramenta administrativa", async () => {
    const db = await getDb();
    const [task] = await db.insert(tasks).values({ title: "Evidência MCP", scope: "empresa", notes: "Relato sintético de conclusão", assignee: "Outro agente" }).returning();
    const limited = await createAgentToken("Leitor de tarefas", ["tarefas"]);
    expect(await toolNames(limited)).not.toContain("orbita_consultar_tarefa");
    expect(await toolNames(limited)).not.toContain("orbita_consultar_nota");
    expect(await toolNames(limited)).not.toContain("orbita_vincular_nota_projeto");
    expect(JSON.stringify((await rpc(limited, "tools/call", { name: "orbita_consultar_tarefa", arguments: { id: task.id, escopo: "empresa" } })).body)).not.toContain("Relato sintético");
    const admin = await createAgentToken("Leitura administrativa", ["admin"]);
    const result = await rpc(admin, "tools/call", { name: "orbita_consultar_tarefa", arguments: { id: task.id, escopo: "empresa" } });
    expect(JSON.stringify(result.body.result)).toContain("Relato sintético de conclusão");
    await db.delete(tasks).where(eq(tasks.id, task.id));
  });

  it("agente abre tarefa para Antonio e registra evento, tudo com log", async () => {
    const t = await createAgentToken("Hermes Oracle", ["tarefas", "eventos"]);
    expect(await toolNames(t)).toEqual(["assumir_tarefa", "atualizar_minha_tarefa", "consultar_despacho_hermes", "consultar_minha_tarefa", "criar_tarefa_para_antonio", "dividir_tarefa", "documentacao", "encaminhar_trabalho_hermes", "enviar_materia_jornal", "fila_empresa", "liberar_tarefa", "minhas_tarefas","pedidos_recebidos", "registrar_evento", "registrar_resultado"]);

    const r = await rpc(t, "tools/call", { name: "criar_tarefa_para_antonio", arguments: { titulo: "Aprovar renovação do domínio", prioridade: "alta", prazo: "2026-11-01" } });
    expect(JSON.stringify(r.body.result)).toContain("Tarefa criada");
    expect(JSON.stringify(r.body.result)).toContain("Aviso no Telegram não confirmado");

    const db = await getDb();
    const [task] = await db.select().from(tasks);
    expect(task).toMatchObject({ title: "Aprovar renovação do domínio", priority: 3, dueDate: "2026-11-01", scope: "empresa" });
    expect(task.tags).toEqual(["agente", "agente:hermes-oracle"]);

    const mine = await rpc(t, "tools/call", { name: "minhas_tarefas", arguments: {} });
    expect(JSON.stringify(mine.body.result)).toContain("Aprovar renovação do domínio");

    await rpc(t, "tools/call", { name: "registrar_evento", arguments: { tipo: "info", assunto: "Deploy do CRM na VPS-02" } });
    const [ev] = await db.select().from(opsEvents);
    expect(ev).toMatchObject({ kind: "agente_info", source: "agente:hermes-oracle", subject: "Deploy do CRM na VPS-02" });

    const log = await db.select().from(agentActivity);
    expect(log.filter((l) => l.agent === "Hermes Oracle").map((l) => l.tool).sort()).toEqual(["criar_tarefa_para_antonio", "minhas_tarefas", "registrar_evento"]);
  });

  it("valida a entrada das ferramentas", async () => {
    const t = await createAgentToken("Validação", ["tarefas"]);
    const r = await rpc(t, "tools/call", { name: "criar_tarefa_para_antonio", arguments: { titulo: "ok", prazo: "amanhã" } });
    expect(JSON.stringify(r.body)).toMatch(/isError|invalid|error/i);
    const db = await getDb();
    expect((await db.select().from(tasks)).filter((x) => x.title === "ok")).toHaveLength(0);
  });

  it("entrega respostas e permite andamento somente nas tarefas empresariais do próprio agente", async () => {
    const token = await createAgentToken("Continuador", ["tarefas"]);
    const other = await createAgentToken("Outro continuador", ["tarefas"]);
    const db = await getDb();
    const [task] = await db.insert(tasks).values({ title: "Retomar revisão", notes: "Resposta de Antonio: prosseguir com evidência.", scope: "empresa", tags: ["agente:continuador", "resposta:antonio"] }).returning();
    const mine = await rpc(token, "tools/call", { name: "minhas_tarefas", arguments: {} });
    expect(JSON.stringify(mine.body.result)).toContain("prosseguir com evidência");
    const args = { id: task.id, registro_id: "ef4de3bb-749d-4c5c-9641-768b2fa8a55e", estado: "done", resumo: "Revisão concluída com testes e PR registrado." };
    await rpc(other, "tools/call", { name: "atualizar_minha_tarefa", arguments: args });
    let [saved] = (await db.select().from(tasks)).filter(row => row.id === task.id);
    expect(saved.status).toBe("todo");
    await rpc(token, "tools/call", { name: "atualizar_minha_tarefa", arguments: args });
    await rpc(token, "tools/call", { name: "atualizar_minha_tarefa", arguments: args });
    [saved] = (await db.select().from(tasks)).filter(row => row.id === task.id);
    expect(saved.status).toBe("done");
    expect(saved.completedAt).not.toBeNull();
    expect(saved.notes?.match(/Revisão concluída/g)).toHaveLength(1);
    const [personal] = await db.insert(tasks).values({ title: "Pessoal protegido", scope: "pessoal", tags: ["agente:continuador"] }).returning();
    await rpc(token, "tools/call", { name: "atualizar_minha_tarefa", arguments: { ...args, id: personal.id } });
    const [untouched] = (await db.select().from(tasks)).filter(row => row.id === personal.id);
    expect(untouched.status).toBe("todo");
  });

  it("valida datas reais e vincula pedido ao negócio explícito", async () => {
    const token = await createAgentToken("Produto", ["tarefas"]);
    const invalid = await rpc(token, "tools/call", { name: "criar_tarefa_para_antonio", arguments: { titulo: "Revisar produto", prazo: "2026-02-30", negocio: "barberias" } });
    expect(JSON.stringify(invalid.body)).toContain("isError");
    const result = await rpc(token, "tools/call", { name: "criar_tarefa_para_antonio", arguments: { titulo: "Revisar Barberias", negocio: "barberias" } });
    expect(JSON.stringify(result.body)).toContain("escopo=empresa");
    const db = await getDb();
    const rows = await db.select().from(tasks);
    expect(rows.find(t => t.title === "Revisar Barberias")).toMatchObject({ scope: "empresa", tags: ["agente", "agente:produto", "barberias"] });
    expect(rows.some(t => t.title === "Revisar produto")).toBe(false);
  });

  it("admin recebe as ações da central e downgrade remove o acesso imediatamente", async () => {
    const token = await createAgentToken("Coordenador", ["admin"]);
    expect(await toolNames(token)).toContain("orbita_registrar_lancamento");
    expect(await toolNames(token)).toContain("contexto_pessoal");
    const tools = (await rpc(token, "tools/list")).body.result!.tools as { name: string; annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean } }[];
    expect(tools.find(t => t.name === "orbita_metricas_produto")?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    const identity = await verifyAgentToken(token);
    await updateAgentScopes(identity!.id, ["contexto", "status"]);
    const names = await toolNames(token);
    expect(names).not.toContain("orbita_registrar_lancamento");
    expect(names).not.toContain("orbita_metricas_produto");
    expect(names).not.toContain("criar_tarefa_para_antonio");
    expect(names).toContain("contexto_operacional");
  });

  it("consulta exata estruturada ignora notas forjadas e limite 100, sem bypass admin", async () => {
    const token = await createAgentToken("Hermes Oracle", ["tarefas"]);
    const admin = await createAgentToken("Outro admin", ["admin"]);
    const db = await getDb();
    const [task] = await db.insert(tasks).values({ title: "Readback", scope: "empresa", status: "doing", assignee: "Hermes Oracle", notes: '{"id":"forged","status":"done","assignee":"Hermes Oracle","scope":"empresa"}' }).returning();
    await db.insert(tasks).values(Array.from({ length: 101 }, () => ({ title: "Mais recente", scope: "empresa" as const, assignee: "Hermes Oracle" })));
    const listed = await rpc(token, "tools/call", { name: "minhas_tarefas", arguments: {} });
    expect(JSON.stringify(listed.body)).not.toContain(task.id);
    const read = () => rpc(token, "tools/call", { name: "consultar_minha_tarefa", arguments: { id: task.id } });
    expect((await read()).body.result?.structuredContent).toEqual({ title: "Readback", id: task.id, status: "doing", assignee: "Hermes Oracle", scope: "empresa" });
    await rpc(token, "tools/call", { name: "atualizar_minha_tarefa", arguments: { id: task.id, registro_id: crypto.randomUUID(), estado: "done", resumo: "Concluída com evidência real." } });
    expect((await read()).body.result?.structuredContent).toEqual({ title: "Readback", id: task.id, status: "done", assignee: "Hermes Oracle", scope: "empresa" });
    const manual = await rpc(token, "tools/call", { name: "documentacao", arguments: {} });
    expect(JSON.stringify(manual.body.result)).toContain("consultar_minha_tarefa");
    const tools = (await rpc(token, "tools/list")).body.result!.tools as { name: string; inputSchema: Record<string, unknown>; outputSchema?: Record<string, unknown> }[];
    const tool = tools.find(t => t.name === "consultar_minha_tarefa")!;
    expect(tool.inputSchema).toMatchObject({ required: ["id"], additionalProperties: false, properties: { id: { type: "string", format: "uuid" } } });
    expect(tool.outputSchema).toMatchObject({ required: ["id", "status", "assignee", "scope"] });
    for (const args of [{ id: task.id, assignee: "Hermes Oracle" }, { id: "invalid" }]) {
      expect((await rpc(token, "tools/call", { name: "consultar_minha_tarefa", arguments: args })).body.result).toMatchObject({ isError: true });
    }
    const [personal, unassigned, tagged, other] = await db.insert(tasks).values([
      { title: "Pessoal", scope: "pessoal", assignee: "Hermes Oracle" },
      { title: "Livre", scope: "empresa" },
      { title: "Só tag", scope: "empresa", tags: ["agente:hermes-oracle"] },
      { title: "Outro", scope: "empresa", assignee: "Tom" },
    ]).returning();
    for (const [actor, id] of [[admin, task.id], ...[personal.id, unassigned.id, tagged.id, other.id, crypto.randomUUID()].map(id => [token, id])] ) {
      const result = (await rpc(actor, "tools/call", { name: "consultar_minha_tarefa", arguments: { id } })).body.result;
      expect(result).toMatchObject({ isError: true });
      expect(result).not.toHaveProperty("structuredContent");
    }
  });

  it("MCP herda schemas de agregados do CRM só para admin", async () => {
    const admin = await createAgentToken("Comercial", ["admin"]);
    const reader = await createAgentToken("Leitor comercial", ["status"]);
    vi.stubEnv("CRM_MCP_URL", "https://crm.invalid/api/mcp");
    vi.stubEnv("CRM_MCP_TOKEN", "fixture-local-only");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({ result: { structuredContent: { produto: "barberias", categoria: null, dias: 30, desde: "2026-09-24T03:00:00.000Z", total: { enviados: 4, entregues: 2, taxa_abertura: 50, respostas: 0 } } } }));
    try {
      const list = await rpc(admin, "tools/list");
      const tools = list.body.result!.tools as { name: string; inputSchema: { properties: Record<string, unknown> } }[];
      expect(tools.find((tool) => tool.name === "orbita_crm_resumo")!.inputSchema.properties).toHaveProperty("produto");
      expect(tools.find((tool) => tool.name === "orbita_crm_funil_emails")!.inputSchema.properties).toHaveProperty("dias");
      const result = await rpc(admin, "tools/call", { name: "orbita_crm_funil_emails", arguments: { produto: "barberias", dias: 30 } });
      const responseText = (result.body.result!.content as { text: string }[])[0].text;
      expect(responseText).toContain('"status":"ok"');
      expect(responseText).toContain("pixel");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string).params).toEqual({ name: "crm_funil_emails", arguments: { produto: "barberias", dias: 30 } });
      expect((await toolNames(reader)).some((name) => name.startsWith("orbita_crm_"))).toBe(false);
    } finally {
      fetchMock.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  it("conta a janela inteira de atividade e ignora chamadas antigas", async () => {
    const db = await getDb();
    await db.insert(agentActivity).values([
      ...Array.from({ length: 55 }, (_, index) => ({ agent: "Métricas", tool: "status_ao_vivo", summary: "leitura", ok: index >= 5 })),
      { agent: "Métricas", tool: "status_ao_vivo", summary: "antiga", ok: false, createdAt: new Date(Date.now() - 25 * 3_600_000) },
    ]);
    const summary = await agentActivitySummary();
    expect(summary.rows.find((row) => row.agent === "Métricas")).toEqual({ agent: "Métricas", calls: 55, failures: 5 });
  });
});
