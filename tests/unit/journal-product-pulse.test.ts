import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const metric = vi.hoisted(() => vi.fn());
vi.mock("@/server/product-metrics", () => ({ productMetrics: metric }));
vi.mock("@/lib/dates", () => ({ today: () => "2026-11-01", localTime: () => "12:00", shiftDate: (_date: string, days: number) => days === 1 ? "2026-11-02" : "2026-10-31", zonedToUtc: (date: string) => new Date(`${date}T03:00:00Z`) }));
import { JournalProductPulse } from "@/components/journal/business-pulse";
const daily = { date: "2026-11-01", timeZone: "America/Sao_Paulo", from: "2026-11-01T03:00:00Z", to: "2026-11-01T15:00:00Z", newUsers: 2, sales: 1 };
beforeEach(() => { vi.stubGlobal("React", React); metric.mockReset(); });
it("uses the application metric slug, renders daily positives and leaves monthly-only products out", async () => {
  metric.mockImplementation(async product => ({ status: "ok", data: { generatedAt: daily.to, daily: product === "aglabs-app" ? daily : undefined, audience: { newMonth: 99 } } }));
  const html = renderToStaticMarkup(await JournalProductPulse());
  expect(metric).toHaveBeenCalledWith("aglabs-app");
  expect(metric).not.toHaveBeenCalledWith("aglabs");
  expect(html).toContain("2 novos usuários hoje"); expect(html).toContain("1 venda hoje");
  expect(html).not.toContain("99"); expect(html).not.toContain("Barberias");
});
it("does not render a section for zero, missing, previous-day or stale data", async () => {
  for (const result of [
    { status: "ok", data: { generatedAt: daily.to, daily: { ...daily, newUsers: 0, sales: 0 } } },
    { status: "unavailable", data: null },
    { status: "stale", data: { generatedAt: daily.to, daily } },
    { status: "ok", data: { generatedAt: daily.to, daily: { ...daily, date: "2026-10-31" } } },
  ]) { metric.mockResolvedValue(result); expect(await JournalProductPulse()).toBeNull(); }
});
it("labels VibeKit records and Barberias team users without inventing confirmed sales", async () => {
  metric.mockImplementation(async product => ({ status: "ok", data: { generatedAt: daily.to, daily: product === "vibekit" ? { ...daily, newUsers: null, sales: null, registeredPurchases: 1 } : product === "barberias" ? { ...daily, sales: null } : undefined } }));
  const html = renderToStaticMarkup(await JournalProductPulse());
  expect(html).toContain("1 compra registrada hoje"); expect(html).toContain("2 novos usuários de equipe hoje");
  expect(html).not.toContain("venda");
});
