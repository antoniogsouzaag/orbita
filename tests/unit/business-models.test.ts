import { describe, expect, it } from "vitest";
import { BUSINESS_UNITS, MODEL_INFO, businessUnit } from "@/lib/business-models";

describe("catálogo de negócios", () => {
  it("tem ids e tags únicos e um modelo conhecido por produto", () => {
    expect(new Set(BUSINESS_UNITS.map((u) => u.id)).size).toBe(BUSINESS_UNITS.length);
    expect(new Set(BUSINESS_UNITS.map((u) => u.tag)).size).toBe(BUSINESS_UNITS.length);
    for (const unit of BUSINESS_UNITS) {
      expect(MODEL_INFO[unit.model]).toBeDefined();
      expect(unit.indicators.length).toBeGreaterThan(0);
      expect(unit.id).toMatch(/^[a-z0-9-]+$/);
    }
  });
  it("não força o modelo SaaS em todos os negócios", () => {
    expect(businessUnit("members")?.model).toBe("marketplace");
    expect(businessUnit("vibekit")?.model).toBe("compra_unica");
    expect(businessUnit("barberias")?.model).toBe("saas_b2b");
    expect(businessUnit("aglabs-app")?.model).toBe("creditos");
    expect(businessUnit("inexistente")).toBeUndefined();
  });
});
