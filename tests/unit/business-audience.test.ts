import { describe, expect, it } from "vitest";
import { validateProductMetrics } from "../../src/lib/product-metrics";
import { businessAudience, sumBusinessAudience } from "../../src/lib/business-audience";

const at = "2026-11-01T02:30:00.000Z"; // Ainda outubro em São Paulo.
const raw = () => ({
  version: 1, product: "members", generatedAt: at, window: { from: "2026-10-01T03:00:00.000Z", to: at },
  metrics: { users: 20, accounts: null, activeAccounts: null, trialAccounts: null, payingAccounts: null, complimentaryAccounts: null, canceledAccounts: null, activatedAccounts: null },
  audience: { version: 1, active30d: null, newMonth: 4, monthFrom: "2026-10-01T03:00:00.000Z", activityFrom: "2026-10-02T02:30:00.000Z", to: at, timeZone: "America/Sao_Paulo", activityBasis: null },
});
const result = () => ({ status: "ok", data: validateProductMetrics(raw(), "members", Date.parse(at)) });

describe("audiência dos aplicativos", () => {
  it("soma só medidas conhecidas e preserva zero confirmado, sem contar o mesmo produto duas vezes", () => {
    const a = result();
    const zero = result(); zero.data.audience!.newMonth = 0;
    expect(sumBusinessAudience([{ id: "members", result: a }, { id: "members", result: a }, { id: "outro", result: zero }, { id: "sem", result: { status: "unavailable", data: null } }], Date.parse(at))).toEqual({
      total: { value: 40, covered: 2, products: 3 }, active: { value: null, covered: 0, products: 3 }, newMonth: { value: 4, covered: 2, products: 3 },
    });
  });
  it("não confunde contas ativas nem novos em 30 dias com usuários engajados ou cadastros no mês", () => {
    const snapshot = raw();
    const legacy = validateProductMetrics({ ...snapshot, product: "barberias", audience: undefined, metrics: { ...snapshot.metrics, accounts: 10, activeAccounts: 8 } }, "barberias", Date.parse(at));
    expect(businessAudience({ status: "ok", data: legacy }, Date.parse(at))).toEqual({ total: 20, active: null, newMonth: null });
  });
  it("exclui snapshots antigos e não leva novos de outubro para novembro", () => {
    expect(businessAudience({ ...result(), status: "stale" }, Date.parse(at)).total).toBeNull();
    expect(businessAudience(result(), Date.parse("2026-11-01T03:01:00Z"))).toEqual({ total: 20, active: null, newMonth: null });
    expect(businessAudience(result(), Date.parse(at) + 25 * 3_600_000).total).toBeNull();
  });
  it.each([
    { newMonth: 21 }, { active30d: 21, activityBasis: "authenticated_product_events" },
    { active30d: 3 }, { monthFrom: "2026-11-01T00:00:00Z" },
    { activityFrom: "2026-10-03T02:30:00Z" }, { timeZone: "UTC" }, { to: "2026-11-01T02:00:00Z" },
  ])("rejeita contagem, fuso ou período incoerente %j", (change) => {
    const snapshot = raw();
    expect(() => validateProductMetrics({ ...snapshot, audience: { ...snapshot.audience, ...change } }, "members", Date.parse(at))).toThrow();
  });
  it("remove campos privados da projeção", () => {
    const snapshot = raw();
    const data = validateProductMetrics({ ...snapshot, audience: { ...snapshot.audience, email: "private@example.invalid" } }, "members", Date.parse(at));
    expect(JSON.stringify(data)).not.toContain("private@example.invalid");
  });
  it("valida união dos papéis e cobertura de reprodução do Members", () => {
    const snapshot=raw();
    const counts={engaged:3,creating:2,selling:1,learning:2};
    const members={rolling30d:counts,currentMonth:counts,playbackObservedFrom:"2026-10-31T12:00:00Z"};
    const audience={...snapshot.audience,active30d:3,activityBasis:"authenticated_product_events",members};
    expect(validateProductMetrics({...snapshot,audience},"members",Date.parse(at)).audience?.members).toEqual(members);
    expect(()=>validateProductMetrics({...snapshot,audience:{...audience,members:{...members,rolling30d:{...counts,engaged:1}}}},"members",Date.parse(at))).toThrow();
    expect(()=>validateProductMetrics({...snapshot,product:"barberias",audience},"barberias",Date.parse(at))).toThrow();
  });
});
