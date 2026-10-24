import { beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/mcp/route";
import { getDb } from "@/db";
import { agentActivity, agentTokens, opsEvents, tasks } from "@/db/schema";
import { agentActivitySummary, createAgentToken, listAgentTokens, revokeAgentToken, verifyAgentToken, updateAgentScopes } from "@/server/agents";

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
    expect(await toolNames(t)).toEqual(["automacoes_operacionais", "documentacao_canonica", "eventos_recentes", "pendencias_github", "status_ao_vivo"]);
    const call = await rpc(t, "tools/call", { name: "criar_tarefa_para_antonio", arguments: { titulo: "não deveria" } });
    expect(JSON.stringify(call.body)).toMatch(/not found|não|error/i);
  });

  it("entrega o mesmo manual por ferramenta, resource e prompt sem ampliar permissões", async () => {
    const token = await createAgentToken("Manual", ["status"]);
    const resources = await rpc(token, "resources/list");
    expect(resources.body.result!.resources).toEqual(expect.arrayContaining([expect.objectContaining({ uri: "orbita://manual", mimeType: "text/markdown" })]));
    const resource = await rpc(token, "resources/read", { uri: "orbita://manual" });
    const manual = await rpc(token, "tools/call", { name: "documentacao_canonica", arguments: {} });
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

  it("agente abre tarefa para Antonio e registra evento, tudo com log", async () => {
    const t = await createAgentToken("Hermes Oracle", ["tarefas", "eventos"]);
    expect(await toolNames(t)).toEqual(["criar_tarefa_para_antonio", "documentacao_canonica", "minhas_tarefas", "pedidos_recebidos", "registrar_evento", "registrar_resultado"]);

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
    const identity = await verifyAgentToken(token);
    await updateAgentScopes(identity!.id, ["contexto", "status"]);
    const names = await toolNames(token);
    expect(names).not.toContain("orbita_registrar_lancamento");
    expect(names).not.toContain("criar_tarefa_para_antonio");
    expect(names).toContain("contexto_operacional");
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
