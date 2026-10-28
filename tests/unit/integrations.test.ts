import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ getDb: vi.fn(async () => ({ execute: vi.fn(async () => []) })) }));
vi.mock("@/server/calendar", () => ({ listCalendars: vi.fn(async () => []) }));
vi.mock("@/server/crm", () => ({ crmConfigured: vi.fn(() => false), crmOverview: vi.fn(async () => ({ configured: false })) }));
vi.mock("@/server/github-inbox", () => ({ githubInboxConfig: vi.fn(() => ({ configured: false, credential: null, org: "aglabs-core", warning: "Cobertura limitada" })), githubInbox: vi.fn() }));
vi.mock("@/server/ops", () => ({ n8nInstances: vi.fn(() => []), n8nOverview: vi.fn() }));
vi.mock("@/server/ops-live", () => ({ liveOps: vi.fn(async () => ({ monitors: [] })) }));
vi.mock("@/server/vault", () => ({ vaultConfig: vi.fn(() => ({ configured: false, local: null, repo: "aglabs-core/ag-labs-knowledge", branch: "main" })), vaultHealth: vi.fn() }));

vi.mock("@/server/product-metrics", () => ({ productMetricsConfigured: vi.fn(() => false), productMetrics: vi.fn() }));
import { productMetrics, productMetricsConfigured } from "@/server/product-metrics";
import { n8nInstances, n8nOverview } from "@/server/ops";
import { checkIntegrationHealth, integrationConfiguration } from "@/server/integrations";

beforeEach(() => {
  vi.mocked(productMetricsConfigured).mockReturnValue(false);
  vi.mocked(productMetrics).mockReset();
  for (const key of ["OPENROUTER_API_KEY", "POSTIZ_API_URL", "POSTIZ_API_KEY", "DATABASE_URL", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "CRON_SECRET", "N8N_INSTANCES", "OPS_TOKEN", "CALENDAR_FEED_TOKEN", "CONTEXT_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "UNSPLASH_ACCESS_KEY", "HERMES_DISPATCH_ENABLED", "HERMES_WEBHOOK_URL", "HERMES_WEBHOOK_SECRET"]) vi.stubEnv(key, "");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("diagnóstico das integrações", () => {
  it("avisa quando a API n8n retorna inventário parcial", async () => {
    vi.mocked(n8nInstances).mockReturnValue([{ name: "vps", url: "https://n8n.example", apiKey: "secret" }]);
    vi.mocked(n8nOverview).mockResolvedValue({ configured: true, documented: [], documentationAvailable: true, instances: [{ name: "vps", url: "https://n8n.example", ok: true, workflows: [], errors: [], workflowsPartial: true }] });
    const rows = await checkIntegrationHealth();
    expect(rows.find(row => row.id === "n8n")).toMatchObject({ state: "warning", detail: expect.stringContaining("inventário incompleto") });
    vi.mocked(n8nInstances).mockReturnValue([]);
  });
  it("consulta os seis negócios independentemente e preserva ausência, falha e snapshot antigo", async () => {
    vi.mocked(productMetricsConfigured).mockReturnValue(true);
    const checkedAt = "2026-10-26T20:00:00.000Z";
    const data = { generatedAt: "2026-10-26T19:00:00.000Z", window: { from: "2026-09-26T19:00:00.000Z", to: "2026-10-26T19:00:00.000Z" } };
    vi.mocked(productMetrics).mockImplementation(async product => {
      if (product === "viajeki") throw new Error("private-url-with-secret");
      const status = product === "mecard" ? "not_configured" : product === "vibekit" ? "unavailable" : product === "members" ? "stale" : "ok";
      return { status, checkedAt, data: status === "ok" || status === "stale" ? data : null, message: "Resultado da origem" } as Awaited<ReturnType<typeof productMetrics>>;
    });
    const rows = await checkIntegrationHealth();
    const products = rows.filter(row => row.category === "Coleta dos negócios");
    expect(products).toHaveLength(6);
    expect(products.find(row => row.id === "produto:barberias")).toMatchObject({ state: "verified", checkedAt });
    expect(products.find(row => row.id === "produto:members")).toMatchObject({ state: "warning" });
    expect(products.find(row => row.id === "produto:mecard")).toMatchObject({ state: "missing" });
    expect(products.find(row => row.id === "produto:vibekit")).toMatchObject({ state: "error" });
    expect(products.find(row => row.id === "produto:viajeki")).toMatchObject({ state: "error" });
    expect(products.find(row => row.id === "produto:aglabs-app")).toMatchObject({ state: "verified" });
    expect(products[0].detail).toContain(data.generatedAt);
    expect(rows.find(row => row.id === "database")).toMatchObject({ state: "warning" });
    expect(JSON.stringify(rows)).not.toContain("private-url-with-secret");
  });
  it("declara Hermes configurado sem despachar comandos nem alegar execução", async () => {
    vi.stubEnv("HERMES_DISPATCH_ENABLED", "true");
    vi.stubEnv("HERMES_WEBHOOK_URL", "https://private.example/webhooks/orbita-hermes");
    vi.stubEnv("HERMES_WEBHOOK_SECRET", "never-expose-hermes-secret");
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const rows = await checkIntegrationHealth();
    expect(rows.find(row => row.id === "hermes")).toMatchObject({ state: "configured", checkedAt: null, href: "/agentes" });
    expect(request).not.toHaveBeenCalled();
    expect(JSON.stringify(rows)).not.toContain("never-expose-hermes-secret");
    expect(JSON.stringify(rows)).not.toContain("private.example");
  });

  it("autentica OpenRouter sem gerar conteúdo e sem expor a credencial", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "secret-openrouter-key");
    const request = vi.fn(async () => Response.json({ data: { limit_remaining: 2, is_disabled: false } }));
    vi.stubGlobal("fetch", request);
    const rows = await checkIntegrationHealth();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("https://openrouter.ai/api/v1/key", expect.objectContaining({ cache: "no-store" }));
    expect(rows.find((row) => row.id === "jev")).toMatchObject({ state: "verified" });
    expect(JSON.stringify(rows)).not.toContain("secret-openrouter-key");
  });
  it("diferencia configuração de verificação e não serializa valores secretos", () => {
    vi.stubEnv("OPENAI_API_KEY", "never-display-ai-key");
    vi.stubEnv("OPS_TOKEN", "never-display-ops-token");
    const rows = integrationConfiguration();
    expect(rows.find((row) => row.id === "ai")).toMatchObject({ state: "configured", checkedAt: null });
    expect(rows.find((row) => row.id === "monitors")).toMatchObject({ state: "configured", checkedAt: null });
    expect(JSON.stringify(rows)).not.toContain("never-display");
  });

  it("consulta bot e destino sem enviar mensagem nem testar IA paga", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "bot-private-token");
    vi.stubEnv("TELEGRAM_CHAT_ID", "1234");
    vi.stubEnv("OPENAI_API_KEY", "private-ai-key");
    const request = vi.fn(async (url: string) => Response.json({ ok: url.endsWith("/getMe") || url.endsWith("/getChat") }));
    vi.stubGlobal("fetch", request);
    const rows = await checkIntegrationHealth();
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls.map(([url]) => url)).toEqual(["https://api.telegram.org/botbot-private-token/getMe", "https://api.telegram.org/botbot-private-token/getChat"]);
    expect(rows.find((row) => row.id === "telegram")).toMatchObject({ state: "verified", detail: "Bot e destino responderam. Nenhuma mensagem foi enviada; entrega não testada." });
    expect(rows.find((row) => row.id === "ai")).toMatchObject({ state: "configured", checkedAt: null });
    expect(JSON.stringify(rows)).not.toContain("private-token");
  });

  it("não chama monitor sem batida de conectado e higieniza falhas de transporte", async () => {
    vi.stubEnv("OPS_TOKEN", "a-valid-long-token-for-ingest");
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "private-token");
    vi.stubEnv("TELEGRAM_CHAT_ID", "1234");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("https://api.telegram.org/botprivate-token/getMe"); }));
    const rows = await checkIntegrationHealth();
    expect(rows.find((row) => row.id === "monitors")).toMatchObject({ state: "warning" });
    expect(rows.find((row) => row.id === "telegram")).toMatchObject({ state: "error" });
    expect(JSON.stringify(rows)).not.toContain("private-token");
  });
});
