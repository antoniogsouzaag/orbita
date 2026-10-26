import { describe, expect, it } from "vitest";
import { validateProductMetrics } from "@/lib/product-metrics";

const at = "2026-10-26T12:00:00.000Z";
const nulls = { accounts: null, activeAccounts: null, trialAccounts: null, payingAccounts: null, complimentaryAccounts: null, canceledAccounts: null, activatedAccounts: null };
const credits = {
  version: 1, currency: "BRL", basis: "admin_analytics_30d",
  users: { total: 500, active30d: 120, generating: 90 },
  sales: { count: 30, payingUsers: 22, revenueCents: 123456 },
  subscriptions: { active: 18, trialing: 4, mrrCents: 81230, byPlan: [{ plan: "basic", active: 10 }, { plan: "premium", active: 8 }] },
  credits: { sold: 40000, purchased: 15000, bonus: 9000, consumed: 52000, refunded: 300 },
  generations: 3400,
};
const raw = { version: 1, product: "aglabs-app", generatedAt: at, window: { from: "2026-09-26T12:00:00.000Z", to: at }, metrics: { users: 500, ...nulls }, credits };
const now = Date.parse(at);

describe("modelo de créditos (AG LABS App)", () => {
  it("preserva o bloco e descarta campos extras", () => {
    const data = validateProductMetrics({ ...raw, credits: { ...credits, topConsumers: [{ email: "private@example.invalid" }] } }, "aglabs-app", now);
    expect(data.credits?.sales.revenueCents).toBe(123456);
    expect(data.credits?.subscriptions?.byPlan).toHaveLength(2);
    expect(JSON.stringify(data)).not.toContain("private");
  });
  it("aceita seções indisponíveis como null e recusa incoerências", () => {
    expect(validateProductMetrics({ ...raw, credits: { ...credits, subscriptions: null, credits: null } }, "aglabs-app", now).credits?.subscriptions).toBeNull();
    expect(() => validateProductMetrics({ ...raw, metrics: { users: 500, ...nulls, payingAccounts: 18 } }, "aglabs-app", now)).toThrow();
    expect(() => validateProductMetrics({ ...raw, metrics: { users: 499, ...nulls } }, "aglabs-app", now)).toThrow();
    expect(() => validateProductMetrics({ ...raw, credits: { ...credits, sales: { count: 2, payingUsers: 3, revenueCents: 10 } } }, "aglabs-app", now)).toThrow();
    expect(() => validateProductMetrics({ ...raw, credits: { ...credits, subscriptions: { ...credits.subscriptions, byPlan: [{ plan: "basic", active: 19 }] } } }, "aglabs-app", now)).toThrow();
    expect(() => validateProductMetrics({ ...raw, product: "aglabs" }, "aglabs", now)).toThrow();
  });
});
