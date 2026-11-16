import { expect, it } from "vitest";
import { projectProductFunnel } from "@/lib/product-funnel";
const at = "2026-11-16T12:00:00.000Z";
const base = { version: 1, kind: "acquisition_sessions", from: "2026-10-18T03:00:00Z", to: "2026-11-17T03:00:00Z", unit: "sessions", ordered: true,
  series: [{ key: "all", values: [10, 5, 2, 0], email: "private" }], sources: [{ key: "direct", values: [10, 5, 2, 0], sessionId: "private" }], email: "private" };
it("projeta apenas agregados e mantém zero confirmado, sem IDs ou texto livre", () => {
  const data = projectProductFunnel(base, "mecard", at);
  expect(data.series[0].values).toEqual([10, 5, 2, 0]);
  expect(JSON.stringify(data)).not.toMatch(/private|email|sessionId/);
});
it("rejeita produto, janela, origem, série ou denominador inconsistentes", () => {
  for (const patch of [{ kind: "trip_creation_users" }, { from: "bad" }, { to: "2027-01-01T00:00:00Z" }, { series: [{ key: "all", values: [1, 2, 0, 0] }] }, { sources: [{ key: "private@example.test", values: [10, 5, 2, 0] }] }, { sources: [] }, { series: [{ key: "all", values: [-1, 0, 0, 0] }] }]) {
    expect(() => projectProductFunnel({ ...base, ...patch }, "mecard", at)).toThrow();
  }
  expect(() => projectProductFunnel(base, "members", at)).toThrow();
});
it("não força coorte entre etapas independentes e preserva cobertura ausente", () => {
  const data = projectProductFunnel({ ...base, kind: "credit_journey_users", unit: "users", ordered: false, to: at, series: [{ key: "all", values: [3, 10, null, 1] }], sources: undefined }, "aglabs-app", at);
  expect(data.ordered).toBe(false); expect(data.series[0].values).toEqual([3, 10, null, 1]);
});
