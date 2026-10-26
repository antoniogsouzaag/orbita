import { describe, expect, it, vi } from "vitest";
import { commerceFunnelSchema, validateProductMetrics } from "@/lib/product-metrics";
import { runAssistantTool } from "@/server/assistant";

export function commerceFixture() {
  return { version: 1, product: "vibekit", generatedAt: "2026-10-26T00:00:00Z", window: { from: "2026-09-27T00:00:00Z", to: "2026-10-26T00:00:00Z" },
    metrics: { users: null, accounts: null, activeAccounts: null, trialAccounts: null, payingAccounts: null, complimentaryAccounts: null, canceledAccounts: null, activatedAccounts: null },
    commerceFunnel: { version: 1, events: Object.fromEntries(Object.keys(commerceFunnelSchema.shape.events.shape).map(key => [key, 2])), observedFrom: "2026-10-25T00:00:00Z", registeredPurchases: 1, provisionedPurchases: 1, registeredCheckoutAmountCents: 9700, currency: "BRL", basis: "anonymous_event_counts_and_registered_live_checkout_records" } };
}
describe("comércio via contrato administrativo", () => {
  it("preserva as unidades comerciais e projeta sem identidades ou segredos", () => {
    const raw = commerceFixture();
    const result = validateProductMetrics({ ...raw, email: "private", commerceFunnel: { ...raw.commerceFunnel, token: "private", events: { ...raw.commerceFunnel.events, checkoutClicks: 50, email: "private" } } }, "vibekit");
    expect(result.commerceFunnel?.events.checkoutClicks).toBe(50);
    expect(result.metrics.accounts).toBeNull();
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("recusa falsa assinatura, valor inseguro e cobertura incoerente", () => {
    const raw = commerceFixture();
    for (const change of [undefined, { ...raw.commerceFunnel, currency: "USD" }, { ...raw.commerceFunnel, provisionedPurchases: 2 }, { ...raw.commerceFunnel, registeredPurchases: 0 }, { ...raw.commerceFunnel, registeredCheckoutAmountCents: Number.MAX_SAFE_INTEGER + 1 }, { ...raw.commerceFunnel, events: {} }, { ...raw.commerceFunnel, observedFrom: null }]) {
      expect(() => validateProductMetrics({ ...raw, commerceFunnel: change }, "vibekit")).toThrow();
    }
    expect(() => validateProductMetrics({ ...raw, metrics: { ...raw.metrics, accounts: 1 } }, "vibekit")).toThrow();
    expect(() => validateProductMetrics({ ...raw, product: "members" }, "members")).toThrow();
    const unknown = { ...raw.commerceFunnel, observedFrom: null, events: Object.fromEntries(Object.keys(raw.commerceFunnel.events).map(key => [key, null])) };
    expect(validateProductMetrics({ ...raw, commerceFunnel: unknown }, "vibekit").commerceFunnel?.events.pageViews).toBeNull();
  });
  it("entrega à ORBE a projeção via CRM com fonte, janela e limites sem escrita", async () => {
    vi.stubEnv("CRM_MCP_URL", "https://crm.example/api/mcp");
    vi.stubEnv("CRM_MCP_TOKEN", "fixture");
    const fetcher = vi.fn(async (_url: unknown, options: RequestInit) => {
      expect(JSON.parse(options.body as string).params).toEqual({ name: "crm_metricas_produto", arguments: { produto: "vibekit" } });
      return Response.json({ result: { structuredContent: { status: "ok", data: { ...commerceFixture(), private: "never-forward" } } } });
    });
    vi.stubGlobal("fetch", fetcher);
    try {
      const result = await runAssistantTool("metricas_produto", { produto: "vibekit" }, { scope: "empresa" });
      const payload = JSON.parse(result.text);
      expect(payload.data.commerceFunnel.registeredPurchases).toBe(1);
      expect(payload.data.window.from).toBe("2026-09-27T00:00:00Z");
      expect(payload.coverage).toContain("não é receita líquida ou liquidada");
      expect(result.text).not.toContain("never-forward");
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllEnvs(); vi.unstubAllGlobals(); }
  });
});
