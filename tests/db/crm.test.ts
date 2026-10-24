import { assistantTools, runAssistantTool } from "@/server/assistant";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// CRM falso: responde como o servidor MCP do crm-dash (JSON-RPC, structuredContent).
let server: http.Server;
let base = "";
const calls: { auth?: string; name: string; args: Record<string, unknown> }[] = [];

const RESUMO = {
  hoje: "2026-10-23", funil: { Lead: 3, Contatado: 1, Atendimento: 2, Proposta: 1, Pagamento: 0 }, oportunidades_abertas: 7, clientes: 4,
  clientes_inativos: 1, contatos_a_qualificar: 2, base_prospeccao: 90, novos_7d: 2, novos_30d: 6, receita_mes: 1200, receita_mes_anterior: 800,
  tarefas: { pendentes: 5, vencidas: 2, para_hoje: 1, por_responsavel: { maia: 1, leo: 2, antonio: 2, tecnico: 0, sem_responsavel: 0 } },
};
const task = (id: string, responsavel: string, prazo: string | null, vencida = false) => ({ id, titulo: `Tarefa ${id}`, descricao: null, prazo, prioridade: "Média", responsavel, contato: null, vencida });

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.headers.authorization !== "Bearer tok-crm-0123456789abcdef0123456789abcdef") {
        res.writeHead(401, { "content-type": "application/json" });
        return res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Não autorizado" } }));
      }
      const msg = JSON.parse(body);
      const { name, arguments: args } = msg.params;
      calls.push({ auth: req.headers.authorization, name, args });
      const ok = (data: unknown) => ({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data, isError: false } });
      let out: unknown;
      if (name === "crm_resumo") out = ok(args.produto ? { ...RESUMO, produto: args.produto, contas_no_produto: { trial: 5, trial_encerrado: 1, ativo: 2, cancelado: 0 } } : RESUMO);
      else if (name === "crm_funil_emails") out = ok({ produto: args.produto ?? null, categoria: args.categoria ?? null, dias: args.dias, desde: "2026-09-24T03:00:00.000Z", total: { enviados: 4, entregues: 2, taxa_abertura: 50, respostas: 0 } });
      else if (name === "crm_tarefas" && args.responsavel === "antonio") out = ok({ total: 2, tarefas: [task("a1", "antonio", "2026-10-22", true), task("a2", "antonio", "2026-10-30")] });
      else if (name === "crm_tarefas") out = ok({ total: 3, tarefas: [task("a1", "antonio", "2026-10-22", true), task("l1", "leo", "2026-10-21", true), task("m1", "maia", "2026-10-23")] });
      else if (name === "crm_criar_tarefa") out = args.responsavel ? ok({ criada: { id: "11111111-1111-4111-8111-111111111111", titulo: args.titulo } }) : null;
      else out = { jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: "contato não encontrado" }], isError: true } };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(out));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
  delete process.env.CRM_MCP_URL;
  delete process.env.CRM_MCP_TOKEN;
});

beforeEach(async () => {
  calls.length = 0;
  process.env.CRM_MCP_URL = `${base}/api/mcp`;
  process.env.CRM_MCP_TOKEN = "tok-crm-0123456789abcdef0123456789abcdef";
  (await import("@/server/crm")).clearCrmCache();
});

describe("CRM pela Órbita", () => {
  it("resume o CRM e separa as tarefas de Antonio das do time", async () => {
    const { crmOverview } = await import("@/server/crm");
    const o = await crmOverview();
    expect(o.configured && o.ok).toBe(true);
    if (!o.configured || !o.ok) return;
    expect(o.summary.receita_mes).toBe(1200);
    expect(o.mine.map((t) => t.id)).toEqual(["a1", "a2"]);
    expect(o.team.map((t) => t.id)).toEqual(["l1", "m1"]);
    expect(o.url).toBe(`${base}/`);
    expect(calls.find((c) => c.name === "crm_tarefas" && !c.args.responsavel)?.args).toEqual({ situacao: "ate_hoje", limite: 12 });
  });

  it("mostra o motivo quando o CRM recusa o token", async () => {
    process.env.CRM_MCP_TOKEN = "outro-token-0123456789abcdef0123456789";
    const { crmOverview } = await import("@/server/crm");
    const o = await crmOverview(0);
    expect(o).toEqual({ configured: true, ok: false, error: "o CRM recusou o token (CRM_MCP_TOKEN)" });
  });

  it("as ferramentas crm_* só aparecem para a IA com o CRM conectado", async () => {
    expect(assistantTools().filter((t) => t.name.startsWith("crm_"))).toHaveLength(8);
    delete process.env.CRM_MCP_URL;
    expect(assistantTools().some((t) => t.name.startsWith("crm_"))).toBe(false);
    expect((await runAssistantTool("crm_resumo", {})).ok).toBe(false);
  });

  it("IA encaminha agregados por produto e mantém o CRM fora do espaço pessoal", async () => {
    const summary = await runAssistantTool("crm_resumo", { produto: "BarberPro" }, { scope: "empresa" });
    expect(summary.ok).toBe(true);
    expect(summary.text).toContain("contas_no_produto");
    expect(calls.at(-1)).toMatchObject({ name: "crm_resumo", args: { produto: "barberias" } });
    const email = await runAssistantTool("crm_funil_emails", { produto: "barberias", dias: 7, categoria: "campanha" }, { scope: "empresa" });
    expect(email.text).toContain("pixel");
    expect(calls.at(-1)).toMatchObject({ name: "crm_funil_emails", args: { produto: "barberias", dias: 7, categoria: "campanha" } });
    expect((await runAssistantTool("crm_funil_emails", {}, { scope: "pessoal" })).ok).toBe(false);
    const before = calls.length;
    expect((await runAssistantTool("crm_funil_emails", { dias: 366 })).ok).toBe(false);
    expect(calls).toHaveLength(before);
  });

  it("a IA cria tarefa para o Léo sem mandar campos nulos e leva o link do CRM", async () => {
    const r = await runAssistantTool("crm_criar_tarefa", JSON.stringify({ titulo: "Enviar proposta por e-mail", responsavel: "leo", descricao: null, prazo: "2026-10-24", prioridade: null, contato_id: null }));
    expect(r.ok, r.text).toBe(true);
    expect(r.text).toContain("para Léo");
    expect(r.action?.href).toBe(`${base}/tasks`);
    expect(calls.at(-1)).toMatchObject({ name: "crm_criar_tarefa", args: { titulo: "Enviar proposta por e-mail", responsavel: "leo", prazo: "2026-10-24" } });
    expect(Object.keys(calls.at(-1)!.args)).not.toContain("descricao");
  });

  it("erro de validação do CRM volta como falha legível", async () => {
    const r = await runAssistantTool("crm_contato", { contato_id: "22222222-2222-4222-8222-222222222222" });
    expect(r).toMatchObject({ ok: false, text: "Não foi possível executar a ferramenta nesta consulta. Confira o estado antes de repetir uma escrita." });
    expect(r.text).not.toContain("contato não encontrado");
    expect((await runAssistantTool("crm_contato", { contato_id: "abc" })).text).toMatch(/Argumentos inválidos/);
  });
});
