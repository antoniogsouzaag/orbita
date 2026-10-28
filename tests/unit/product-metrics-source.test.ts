import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { productMetrics } from "@/server/product-metrics";
import { assistantTools, runAssistantTool } from "@/server/assistant";
import { ORBE_STRATEGY_RULES } from "@/lib/orbe-context";
const url = "https://barberias.com.br/api/integrations/orbita/metrics";
const raw = () => ({ version: 1, product: "barberias", generatedAt: new Date().toISOString(), window: { from: "2026-10-01T00:00:00Z", to: new Date().toISOString() }, metrics: { users: 8, accounts: 4, activeAccounts: 3, trialAccounts: 1, payingAccounts: 1, complimentaryAccounts: 1, canceledAccounts: 0, activatedAccounts: 2 }, secret: "never-return" });
const configure = (target = url) => vi.stubEnv("APP_METRICS_SOURCES", JSON.stringify([{ product: "barberias", url: target, token: "fixture-only-".repeat(4) }]));
beforeEach(() => { configure(); vi.stubGlobal("fetch", vi.fn(async () => Response.json(raw()))); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("origem administrativa e ORBE", () => {
  it.each(["mecard", "viajeki", "produto-desconhecido"])("não atribui equipe ou Stripe ao produto %s", async produto => {
    vi.stubEnv("APP_METRICS_SOURCES", "[]");
    const result = await runAssistantTool("metricas_produto", { produto }, { scope: "empresa", readOnly: true });
    const body = JSON.parse(result.text);
    expect(body).toMatchObject({ product: produto, status: "not_configured", data: null });
    expect(body.coverage).not.toMatch(/equipe com login|assinatura Stripe|activationFunnel/);
    expect(fetch).not.toHaveBeenCalled();
    if (produto !== "produto-desconhecido") {
      expect(body.businessModel).toMatchObject({ unit: "Usuário" });
      expect(body.coverage).toContain("não se aplicam");
    }
  });
  it("preserva o significado de equipe e vigência do Barberias", async () => {
    const result = await runAssistantTool("metricas_produto", { produto: "barberias" }, { scope: "empresa", readOnly: true });
    const body = JSON.parse(result.text);
    expect(body.coverage).toContain("users é equipe com login");
    expect(body.coverage).toContain("não comprovante de recebimento");
  });
  it("usa fonte fixa HTTPS e não permite redirect nem cache", async () => {
    expect(await productMetrics("barberias")).toMatchObject({ status: "ok", data: { metrics: { users: 8 } } });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ redirect: "error", cache: "no-store", signal: expect.any(AbortSignal) }));
  });
  it.each(["http://barberias.com.br/api/integrations/orbita/metrics", "https://evil.test/api/integrations/orbita/metrics", "https://barberias.com.br:444/api/integrations/orbita/metrics", url + "?token=private", url + "#a", "https://barberias.com.br/admin"])("recusa destino inválido antes da rede: %s", async target => {
    configure(target); expect(await productMetrics("barberias")).toMatchObject({ status: "unavailable", data: null }); expect(fetch).not.toHaveBeenCalled();
  });
  it("não conectado não vira zero nem faz rede", async () => {
    vi.stubEnv("APP_METRICS_SOURCES", "[]");
    const result = await runAssistantTool("metricas_produto", { produto: "barberias" }, { scope: "empresa" });
    expect(JSON.parse(result.text)).toMatchObject({ status: "not_configured", data: null }); expect(fetch).not.toHaveBeenCalled();
  });
  it("recusa produto divergente e não repassa dados fora do contrato", async () => {
    const result = await runAssistantTool("metricas_produto", { produto: "barberpro" }, { scope: "empresa" });
    expect(JSON.parse(result.text)).toMatchObject({ product: "barberias", status: "ok" }); expect(result.text).not.toContain("never-return");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ...raw(), product: "members" })));
    expect(await productMetrics("barberias")).toMatchObject({ status: "unavailable", data: null });
  });
  it("snapshot antigo é explicitamente stale", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ...raw(), generatedAt: new Date(Date.now() - 25 * 3600000).toISOString() })));
    expect((await productMetrics("barberias")).status).toBe("stale");
  });
  it.each([true, false])("limita resposta com ou sem content-length (%s)", async declared => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x".repeat(32769), { headers: declared ? { "content-length": "32769" } : {} })));
    expect(await productMetrics("barberias")).toMatchObject({ status: "unavailable", data: null });
  });
  it("erros não expõem token ou detalhe do provedor", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("fixture-only-secret"); }));
    const result = await productMetrics("barberias"); expect(result.status).toBe("unavailable"); expect(JSON.stringify(result)).not.toContain("fixture-only-secret");
  });
  it("catálogo e execução mantêm Empresa/Pessoal separados", async () => {
    expect(assistantTools("empresa").find(t => t.name === "metricas_produto")?.readOnly).toBe(true);
    expect(assistantTools("pessoal").some(t => t.name === "metricas_produto")).toBe(false);
    expect((await runAssistantTool("metricas_produto", { produto: "barberias" }, { scope: "pessoal" })).ok).toBe(false);
    expect(ORBE_STRATEGY_RULES).toContain("consulte metricas_produto");
    expect(ORBE_STRATEGY_RULES).toContain("Não prometa uma operação inexistente");
  });
});

it("CRM centraliza coleta sem fallback direto quando não configurada", async () => {
  vi.stubEnv("CRM_MCP_URL", "https://crm.example/api/mcp"); vi.stubEnv("CRM_MCP_TOKEN", "fixture");
  const fetcher = vi.fn(async (_url: unknown, options: RequestInit) => {
    expect(JSON.parse(options.body as string).params.name).toBe("crm_metricas_produto");
    return Response.json({ result: { structuredContent: { status: "not_configured", data: null } } });
  });
  vi.stubGlobal("fetch", fetcher);
  expect(await productMetrics("barberias")).toMatchObject({ status: "not_configured", data: null });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("preserva desatualização informada pelo CRM sem inventar idade superior a 24 horas", async () => {
  vi.stubEnv("CRM_MCP_URL", "https://crm.example/api/mcp"); vi.stubEnv("CRM_MCP_TOKEN", "fixture");
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ result: { structuredContent: { status: "stale", data: raw() } } })));
  const result = await productMetrics("barberias");
  expect(result).toMatchObject({ status: "stale", data: { product: "barberias" } });
  expect(result.message).toContain("CRM informou");
  expect(result.message).not.toContain("24 horas");
});

it("identifica snapshot de mais de 24 horas mesmo quando o CRM informa ok", async () => {
  vi.stubEnv("CRM_MCP_URL", "https://crm.example/api/mcp"); vi.stubEnv("CRM_MCP_TOKEN", "fixture");
  const snapshot = { ...raw(), generatedAt: new Date(Date.now() - 25 * 3_600_000).toISOString() };
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ result: { structuredContent: { status: "ok", data: snapshot } } })));
  const result = await productMetrics("barberias");
  expect(result).toMatchObject({ status: "stale", data: { product: "barberias" } });
  expect(result.message).toContain("mais de 24 horas");
});
