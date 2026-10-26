import { z } from "zod";

const count = z.number().int().nonnegative();
const period = z.object({ grossCents: count, platformFeeCents: count, paidItems: count });
export const marketplaceMetricsSchema = z.object({
  version: z.literal(1), currency: z.literal("BRL"), basis: z.literal("platform_financial_report_and_producer_status"),
  currentMonth: period.extend({ from: z.iso.datetime() }),
  previousMonth: period.extend({ from: z.iso.datetime(), to: z.iso.datetime() }),
  producers: z.object({ onboarding: count, approved: count }),
  users: z.object({ total: count, new30d: count }),
});

/** Same calendar rule as Members spStartOfMonth, including the local year rollover. */
function monthStart(end: string, delta: number) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(new Date(end));
  return Date.UTC(Number(parts.find(p => p.type === "year")?.value), Number(parts.find(p => p.type === "month")?.value) - 1 + delta, 1, 3);
}
export function validateMarketplaceMetrics(data: z.infer<typeof marketplaceMetricsSchema>, window: { from: string; to: string }, users: number | null) {
  const cur = data.currentMonth, prev = data.previousMonth;
  if (cur.from !== window.from || prev.to !== cur.from || Date.parse(cur.from) !== monthStart(window.to, 0) || Date.parse(prev.from) !== monthStart(window.to, -1)) throw new Error("Meses de marketplace inválidos");
  for (const p of [cur, prev]) if (p.platformFeeCents > p.grossCents || (p.paidItems === 0 && p.grossCents !== 0)) throw new Error("Valores de marketplace inválidos");
  if (data.users.total !== users || data.users.new30d > data.users.total || data.producers.approved > data.producers.onboarding || data.producers.onboarding > data.users.total) throw new Error("Contagens de marketplace inválidas");
}
