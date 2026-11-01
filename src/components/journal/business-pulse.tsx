import Link from "next/link";
import { BUSINESS_UNITS } from "@/lib/business-models";
import { today, localTime } from "@/lib/dates";
import { journalDailyMetrics } from "@/lib/journal-daily";
import { productMetrics } from "@/server/product-metrics";

export async function JournalProductPulse() {
  const date = today();
  const rows = await Promise.all(BUSINESS_UNITS.map(async unit => {
    const result = await productMetrics(unit.id);
    return { unit, daily: result.status === "ok" ? journalDailyMetrics(result.data, date) : null };
  }));
  const news = rows.filter(row => row.daily);
  if (!news.length) return null;
  return <section className="border-t border-border py-3" aria-labelledby="journal-products">
    <h2 id="journal-products" className="text-sm font-semibold">Movimento de hoje</h2>
    <ul className="mt-3 space-y-3">{news.map(({ unit, daily }) => <li key={unit.id}>
      <Link href={`/empresa/negocios/${unit.id}`} className="text-xs font-medium text-accent">{unit.name} →</Link>
      <p className="mt-1 text-sm">{[daily!.newUsers ? `${daily!.newUsers.toLocaleString("pt-BR")} novo${daily!.newUsers === 1 ? " usuário" : "s usuários"}${unit.id === "barberias" ? " de equipe" : ""} hoje` : null, daily!.sales ? `${daily!.sales.toLocaleString("pt-BR")} venda${daily!.sales === 1 ? "" : "s"} hoje` : null, daily!.registeredPurchases ? `${daily!.registeredPurchases.toLocaleString("pt-BR")} compra${daily!.registeredPurchases === 1 ? " registrada" : "s registradas"} hoje` : null].filter(Boolean).join(" · ")}</p>
      <p className="mt-1 text-[10px] text-faint">Até {localTime(new Date(daily!.to))} · horário de São Paulo · fonte: aplicativo via coleta administrativa</p>
    </li>)}</ul>
  </section>;
}
