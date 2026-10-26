import type { ProductMetrics } from "./product-metrics";
import { saoPauloMonthStart } from "./audience-metrics";

type Snapshot = { status: string; data: ProductMetrics | null };
export function businessAudience(result: Snapshot, now = Date.now()) {
  const data = result.status === "ok" ? result.data : null;
  if (!data || now - Date.parse(data.generatedAt) > 24 * 3_600_000) return { total: null, active: null, newMonth: null };
  return {
    total: data.metrics.users,
    active: data.audience?.active30d ?? data.credits?.users.active30d ?? null,
    newMonth: data.audience && Date.parse(data.audience.monthFrom) === saoPauloMonthStart(now) ? data.audience.newMonth : null,
  };
}

export function sumBusinessAudience(rows: { id: string; result: Snapshot }[], now = Date.now()) {
  // Identidades não são compartilhadas entre aplicativos; somar cadastros, sem deduplicação entre apps.
  const unique = new Map(rows.map(row => [row.id, businessAudience(row.result, now)]));
  return Object.fromEntries((["total", "active", "newMonth"] as const).map(key => {
    const known = [...unique.values()].map(row => row[key]).filter((value): value is number => value !== null);
    const total = known.reduce((sum, value) => sum + value, 0);
    return [key, { value: known.length && Number.isSafeInteger(total) ? total : null, covered: known.length, products: unique.size }];
  })) as Record<"total" | "active" | "newMonth", { value: number | null; covered: number; products: number }>;
}
