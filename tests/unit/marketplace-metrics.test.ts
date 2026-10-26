import { describe, expect, it, vi } from "vitest";
import { validateProductMetrics } from "@/lib/product-metrics";
import { runAssistantTool } from "@/server/assistant";

const current = "2026-10-01T03:00:00.000Z";
const fixture = () => ({ version: 1, product: "members", generatedAt: "2026-10-26T09:00:00.000Z", window: { from: current, to: "2026-10-26T09:00:00.000Z" },
  metrics: { users: 23, accounts: null, activeAccounts: null, trialAccounts: null, payingAccounts: null, complimentaryAccounts: null, canceledAccounts: null, activatedAccounts: null },
  marketplace: { version: 1, currency: "BRL", basis: "platform_financial_report_and_producer_status", currentMonth: { from: current, grossCents: 9700, platformFeeCents: 900, paidItems: 1 }, previousMonth: { from: "2026-09-01T03:00:00.000Z", to: current, grossCents: 0, platformFeeCents: 0, paidItems: 0 }, producers: { onboarding: 10, approved: 2 }, users: { total: 23, new30d: 4 } } });

describe("Members marketplace na Órbita", () => {
  it("preserva a unidade de produtor e descarta identidades, mantendo compatibilidade com o app antigo", () => {
    const raw = fixture();
    const result = validateProductMetrics({ ...raw, marketplace: { ...raw.marketplace, email: "private", producers: { ...raw.marketplace.producers, names: ["private"] } } }, "members");
    expect(result.marketplace?.currentMonth.platformFeeCents).toBe(900);
    expect(result.metrics.payingAccounts).toBeNull();
    expect(JSON.stringify(result)).not.toContain("private");
    expect(validateProductMetrics({ ...raw, marketplace: undefined }, "members").marketplace).toBeUndefined();
  });
  it("recusa contagens financeiras contraditórias e períodos que não são meses consecutivos", () => {
    const raw = fixture();
    for (const change of [{ currency: "USD" }, { producers: { onboarding: 1, approved: 2 } }, { users: { total: 24, new30d: 4 } }, { currentMonth: { ...raw.marketplace.currentMonth, platformFeeCents: 9701 } }, { currentMonth: { ...raw.marketplace.currentMonth, paidItems: 0 } }, { previousMonth: { ...raw.marketplace.previousMonth, from: "2026-08-01T03:00:00.000Z" } }]) {
      expect(() => validateProductMetrics({ ...raw, marketplace: { ...raw.marketplace, ...change } }, "members")).toThrow();
    }
    expect(() => validateProductMetrics({ ...raw, metrics: { ...raw.metrics, accounts: 1 } }, "members")).toThrow();
    expect(() => validateProductMetrics({ ...raw, product: "mecard" }, "mecard")).toThrow();
    const mid = "2026-10-02T03:00:00.000Z";
    expect(() => validateProductMetrics({ ...raw, window: { ...raw.window, from: mid }, marketplace: { ...raw.marketplace, currentMonth: { ...raw.marketplace.currentMonth, from: mid }, previousMonth: { ...raw.marketplace.previousMonth, to: mid } } }, "members")).toThrow();
  });
  it("valida a virada do mês e do ano no fuso do produto", () => {
    const raw = fixture();
    for (const [to, cur, prev] of [["2027-01-01T02:30:00.000Z", "2026-12-01T03:00:00.000Z", "2026-11-01T03:00:00.000Z"], ["2027-01-01T03:00:00.000Z", "2027-01-01T03:00:00.000Z", "2026-12-01T03:00:00.000Z"]]) {
      expect(validateProductMetrics({ ...raw, generatedAt: to, window: { from: cur, to }, marketplace: { ...raw.marketplace, currentMonth: { ...raw.marketplace.currentMonth, from: cur }, previousMonth: { ...raw.marketplace.previousMonth, from: prev, to: cur } } }, "members", Date.parse(to)).marketplace).toBeDefined();
    }
  });
  it("a ORBE recebe agregados via CRM com limites de receita e sem operações no app", async () => {
    vi.stubEnv("CRM_MCP_URL", "https://crm.example/api/mcp"); vi.stubEnv("CRM_MCP_TOKEN", "fixture");
    const fetcher = vi.fn(async (_url: unknown, options: RequestInit) => {
      expect(JSON.parse(options.body as string).params).toEqual({ name: "crm_metricas_produto", arguments: { produto: "members" } });
      return Response.json({ result: { structuredContent: { status: "ok", data: fixture() } } });
    });
    vi.stubGlobal("fetch", fetcher);
    try {
      const result = await runAssistantTool("metricas_produto", { produto: "members" }, { scope: "empresa" });
      expect(JSON.parse(result.text).data.marketplace.producers.approved).toBe(2);
      expect(JSON.parse(result.text).coverage).toContain("não comprova liquidação");
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); }
  });
});
