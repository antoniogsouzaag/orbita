import { Card } from "@/components/ui/card";
import { productMetrics } from "@/server/product-metrics";

export async function ProductAppMetrics({ product }: { product: string }) {
  const result = await productMetrics(product);
  const metrics = result.data?.metrics;
  const items = [
    ["Usuários cadastrados", metrics?.users], ["Contas / estabelecimentos", metrics?.accounts],
    ["Contas ativas", metrics?.activeAccounts], ["Em teste", metrics?.trialAccounts],
    ["Pagantes vigentes", metrics?.payingAccounts], ["Cortesias", metrics?.complimentaryAccounts],
    ["Contas ativadas", metrics?.activatedAccounts], ["Canceladas", metrics?.canceledAccounts],
  ] as const;
  return <Card className="overflow-hidden"><div className="border-b border-border px-5 py-4"><p className="text-[10px] uppercase tracking-widest text-accent">Produto · dados administrativos</p><h2 className="mt-1 font-semibold">Uso, contas e assinatura</h2><p className="mt-2 text-xs text-muted">{result.message}</p></div><dl className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4">{items.map(([label,value]) => <div key={label} className="p-5"><dt className="text-[11px] text-muted">{label}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{value?.toLocaleString("pt-BR") ?? "—"}</dd></div>)}</dl><p className="border-t border-border px-5 py-3 text-[10px] leading-relaxed text-faint">Fonte: API administrativa do app · tentativa {new Date(result.checkedAt).toLocaleString("pt-BR", {timeZone:"America/Sao_Paulo"})}{result.data ? ` · snapshot ${new Date(result.data.generatedAt).toLocaleString("pt-BR", {timeZone:"America/Sao_Paulo"})}` : " · sem snapshot disponível"}. Conta ativa, cortesia, ativação e pagamento são medidas distintas. — indica dado não disponível.</p></Card>;
}
