import { describe, expect, it } from "vitest";
import { validateProductMetrics } from "@/lib/product-metrics";

const raw = { version: 1, product: "barberias", generatedAt: "2026-10-24T12:00:00Z", window: {from:"2026-10-01T00:00:00Z",to:"2026-10-24T12:00:00Z"},metrics:{users:10,accounts:5,activeAccounts:3,trialAccounts:2,payingAccounts:null,complimentaryAccounts:1,canceledAccounts:0,activatedAccounts:2}, secret:"private" };
describe("contrato administrativo dos produtos", () => {
  it("preserva apenas o funil cumulativo válido e continua aceitando a origem antiga", () => {
    const activationFunnel = { professional: 4, catalog: 4, readyForBooking: 3, firstAppointment: 2, email: "private@example.invalid" };
    const data = validateProductMetrics({ ...raw, activationFunnel }, "barberias");
    expect(data.activationFunnel).toEqual({ professional: 4, catalog: 4, readyForBooking: 3, firstAppointment: 2 });
    expect(validateProductMetrics(raw, "barberias").activationFunnel).toBeUndefined();
    for (const invalid of [{ professional: 6 }, { catalog: 5 }, { readyForBooking: -1 }, { firstAppointment: 1 }]) {
      expect(() => validateProductMetrics({ ...raw, activationFunnel: { ...activationFunnel, ...invalid } }, "barberias")).toThrow();
    }
  });
  it("mantém indisponível separado de zero e descarta dados fora do contrato", () => {
    const data = validateProductMetrics(raw,"barberias",Date.parse(raw.generatedAt));
    expect(data.metrics.payingAccounts).toBeNull();
    expect(data.metrics.canceledAccounts).toBe(0);
    expect(data).not.toHaveProperty("secret");
  });
  it("recusa produto divergente e janela invertida", () => {
    expect(() => validateProductMetrics(raw,"mecard")).toThrow();
    expect(() => validateProductMetrics({...raw,window:{from:raw.window.to,to:raw.window.from}},"barberias")).toThrow();
  });
});

const nulls = { accounts: null, activeAccounts: null, trialAccounts: null, payingAccounts: null, complimentaryAccounts: null, canceledAccounts: null, activatedAccounts: null };
const marketplace = {
  version: 1, currency: "BRL", basis: "platform_financial_report_and_producer_status",
  currentMonth: { from: "2026-10-01T03:00:00.000Z", grossCents: 125000, platformFeeCents: 9800, paidItems: 14 },
  previousMonth: { from: "2026-09-01T03:00:00.000Z", to: "2026-10-01T03:00:00.000Z", grossCents: 90000, platformFeeCents: 7200, paidItems: 9 },
  producers: { onboarding: 40, approved: 12 },
  users: { total: 230, new30d: 31 },
};
const members = { version: 1, product: "members", generatedAt: "2026-10-26T12:00:00Z", window: { from: "2026-10-01T03:00:00.000Z", to: "2026-10-26T12:00:00Z" }, metrics: { users: 230, ...nulls }, marketplace };

describe("modelos de negócio no contrato", () => {
  it("preserva o bloco de marketplace do Members e descarta campos extras", () => {
    const data = validateProductMetrics({ ...members, marketplace: { ...marketplace, buyers: ["private@example.invalid"] } }, "members", Date.parse(members.generatedAt));
    expect(data.marketplace?.currentMonth).toEqual({ from: "2026-10-01T03:00:00.000Z", grossCents: 125000, platformFeeCents: 9800, paidItems: 14 });
    expect(data.marketplace?.producers).toEqual({ onboarding: 40, approved: 12 });
    expect(JSON.stringify(data)).not.toContain("private");
  });
  it("recusa marketplace incoerente ou em outro produto", () => {
    const at = Date.parse(members.generatedAt);
    expect(() => validateProductMetrics({ ...members, marketplace: { ...marketplace, producers: { onboarding: 1, approved: 2 } } }, "members", at)).toThrow();
    expect(() => validateProductMetrics({ ...members, metrics: { users: 229, ...nulls } }, "members", at)).toThrow();
    expect(() => validateProductMetrics({ ...members, marketplace: { ...marketplace, currentMonth: { ...marketplace.currentMonth, platformFeeCents: 200000 } } }, "members", at)).toThrow();
    expect(() => validateProductMetrics({ ...members, product: "mecard", marketplace }, "mecard", at)).toThrow();
  });
  it("preserva o funil de compra única do VibeKit", () => {
    const events = { pageViews: 10, pricingViews: 6, ctaClicks: 4, checkoutClicks: 3, checkoutCreated: 2, checkoutFailures: 0, successViews: 1 };
    const raw = { ...members, product: "vibekit", metrics: { users: null, ...nulls }, marketplace: undefined, commerceFunnel: { version: 1, events, observedFrom: "2026-10-20T00:00:00Z", registeredPurchases: 1, provisionedPurchases: 1, registeredCheckoutAmountCents: 4990, currency: "BRL", basis: "x" } };
    const data = validateProductMetrics(raw, "vibekit", Date.parse(members.generatedAt));
    expect(data.commerceFunnel?.events.checkoutClicks).toBe(3);
    expect(() => validateProductMetrics({ ...raw, commerceFunnel: { ...raw.commerceFunnel, provisionedPurchases: 2 } }, "vibekit", Date.parse(members.generatedAt))).toThrow();
  });
});
