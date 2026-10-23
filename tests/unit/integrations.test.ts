import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ getDb: vi.fn(async () => ({ execute: vi.fn(async () => []) })) }));
vi.mock("@/server/calendar", () => ({ listCalendars: vi.fn(async () => []) }));
vi.mock("@/server/crm", () => ({ crmConfigured: vi.fn(() => false), crmOverview: vi.fn(async () => ({ configured: false })) }));
vi.mock("@/server/github-inbox", () => ({ githubInboxConfig: vi.fn(() => ({ configured: false, credential: null, org: "aglabs-core", warning: "Cobertura limitada" })), githubInbox: vi.fn() }));
vi.mock("@/server/ops", () => ({ n8nInstances: vi.fn(() => []), n8nOverview: vi.fn() }));
vi.mock("@/server/ops-live", () => ({ liveOps: vi.fn(async () => ({ monitors: [] })) }));
vi.mock("@/server/vault", () => ({ vaultConfig: vi.fn(() => ({ configured: false, local: null, repo: "aglabs-core/ag-labs-knowledge", branch: "main" })), vaultHealth: vi.fn() }));

import { checkIntegrationHealth, integrationConfiguration } from "@/server/integrations";

beforeEach(() => {
  for (const key of ["DATABASE_URL", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "CRON_SECRET", "N8N_INSTANCES", "OPS_TOKEN", "CALENDAR_FEED_TOKEN", "CONTEXT_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "UNSPLASH_ACCESS_KEY"]) vi.stubEnv(key, "");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("diagnóstico das integrações", () => {
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
