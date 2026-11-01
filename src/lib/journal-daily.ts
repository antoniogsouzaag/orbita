import type { ProductMetrics } from "./product-metrics";
import { shiftDate, zonedToUtc } from "./dates";

/** Only explicit same-day aggregates qualify; monthly totals never become daily news. */
export function journalDailyMetrics(data: ProductMetrics | null, date: string) {
  const daily = data?.daily;
  if (!daily || daily.date !== date || daily.timeZone !== "America/Sao_Paulo") return null;
  const from = zonedToUtc(date, "00:00", "America/Sao_Paulo").getTime(), until = zonedToUtc(shiftDate(date, 1), "00:00", "America/Sao_Paulo").getTime();
  const to = Date.parse(daily.to);
  if (Date.parse(daily.from) !== from || to < from || to >= until || to !== Date.parse(data!.generatedAt)) return null;
  if (!(daily.newUsers && daily.newUsers > 0) && !(daily.sales && daily.sales > 0) && !(daily.registeredPurchases && daily.registeredPurchases > 0)) return null;
  return daily;
}
