import { describe, expect, it } from "vitest";
import { validateProductMetrics } from "@/lib/product-metrics";

const raw = { version: 1, product: "barberias", generatedAt: "2026-10-24T12:00:00Z", window: {from:"2026-10-01T00:00:00Z",to:"2026-10-24T12:00:00Z"},metrics:{users:10,accounts:5,activeAccounts:3,trialAccounts:2,payingAccounts:null,complimentaryAccounts:1,canceledAccounts:0,activatedAccounts:2}, secret:"private" };
describe("contrato administrativo dos produtos", () => {
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
