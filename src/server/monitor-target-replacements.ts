import "server-only";
import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { withDbTransaction } from "@/db";
import { opsEvents, opsStatus } from "@/db/schema";

// Explicit destination changes requested by Antonio on 2026-10-29 and 2026-10-30.
// Names and missing targets never authorize retiring a monitor.
const replacements = [
  ["https://cortes-virais.pages.dev/", "https://cortes.lojalabs.com.br/"],
  ["https://pack-canva.pages.dev/", "https://pack.lojalabs.com.br/"],
  ["https://lp.aglabs.app.br/", "https://aglabs.app.br/sobre"],
] as const;
const normalize = (url: string) => url.replace(/\/+$/, "");

/** Reconcile only a real collector receipt for an explicitly approved replacement. */
export async function reconcileMonitorTargets(source: string, receivedUrls: string[], at: Date) {
  if (source !== "n8n-vps03-ping") return 0;
  const urls = new Set(receivedUrls.map(normalize));
  const pending = replacements.filter(([oldUrl, newUrl]) => urls.has(normalize(newUrl)) && !urls.has(normalize(oldUrl)));
  if (!pending.length) return 0;
  return withDbTransaction(async tx => {
    let count = 0;
    for (const [oldUrl, newUrl] of pending) {
      const [current] = await tx.select().from(opsStatus).where(and(eq(opsStatus.source, source), sql`rtrim(${opsStatus.url}, '/') = ${normalize(newUrl)}`, eq(opsStatus.checkedAt, at)));
      if (!current) continue;
      const retired = await tx.delete(opsStatus).where(and(eq(opsStatus.source, source), sql`rtrim(${opsStatus.url}, '/') = ${normalize(oldUrl)}`, lte(opsStatus.checkedAt, at))).returning();
      if (!retired.length) continue;
      const resolution = { reason: "target_replaced", replacementUrl: current.url, replacedAt: at.toISOString() };
      await tx.update(opsEvents).set({ resolvedAt: at, detail: sql`${opsEvents.detail} || ${JSON.stringify({ resolution })}::jsonb` }).where(and(eq(opsEvents.source, source), eq(opsEvents.kind, "site_down"), isNull(opsEvents.resolvedAt), sql`rtrim(${opsEvents.detail}->>'url', '/') = ${normalize(oldUrl)}`));
      for (const previous of retired) await tx.insert(opsEvents).values({kind:"site_target_replaced",severity:"info",source,subject:current.name,createdAt:new Date(),detail:{previous, replacementUrl:current.url,receiptAt:at.toISOString(),reason:"owner_authorized_domain_change"}});
      count += retired.length;
    }
    return count;
  });
}

/** Apply the same approved migration to receipts that arrived before this release.
 * Never sends probes, advances check timestamps or fabricates a monitor heartbeat. */
export async function reconcileStoredMonitorTargets(status: (typeof opsStatus.$inferSelect)[], now: number) {
  const source = "n8n-vps03-ping";
  const rows = status.filter(s => s.source === source);
  let count = 0;
  for (const [oldUrl, newUrl] of replacements) {
    const previous = rows.find(s => normalize(s.url) === normalize(oldUrl));
    const current = rows.find(s => normalize(s.url) === normalize(newUrl));
    if (!previous || !current || current.checkedAt <= previous.checkedAt || current.checkedAt.getTime() > now || now - current.checkedAt.getTime() > 40 * 60_000) continue;
    count += await reconcileMonitorTargets(source, rows.filter(s=>s.checkedAt.getTime() === current.checkedAt.getTime()).map(s=>s.url), current.checkedAt);
  }
  return count;
}
