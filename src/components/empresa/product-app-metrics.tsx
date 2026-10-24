import { Card } from "@/components/ui/card";
import { BarRows } from "@/components/ui/mini-charts";
import { productMetrics } from "@/server/product-metrics";

const when = (v: string) => new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

export async function ProductAppMetrics({ product }: { product: string }) {
  const result = await productMetrics(product);
  if (!result.data) return <Card className="flex flex-wrap items-center gap-4 p-5"><div className="min-w-0 flex-1"><p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint">Dados do app · conexão pendente</p><h2 className="mt-1 text-sm font-semibold">Uso, contas e assinaturas</h2><p className="mt-2 text-xs leading-relaxed text-muted">{result.message}</p></div><span className="rounded-full border border-border px-3 py-1 text-[11px] text-muted">Sem snapshot disponível</span></Card>;
  const m = result.data.metrics;
  const headline = [["Usuários cadastrados", m?.users], ["Contas / estabelecimentos", m?.accounts], ["Pagantes vigentes", m?.payingAccounts], ["Em teste", m?.trialAccounts]] as const;
  // Cada medida é independente: barras como fração das contas, nunca como partes de um todo.
  const shares = [
    { key: "ativas", label: "Ativas", value: m?.activeAccounts, tone: "ok" as const },
    { key: "ativadas", label: "Ativadas", value: m?.activatedAccounts, tone: "accent" as const },
    { key: "pagantes", label: "Pagantes vigentes", value: m?.payingAccounts, tone: "accent" as const },
    { key: "teste", label: "Em teste", value: m?.trialAccounts, tone: "warn" as const },
    { key: "cortesias", label: "Cortesias", value: m?.complimentaryAccounts, tone: "idle" as const },
    { key: "canceladas", label: "Canceladas", value: m?.canceledAccounts, tone: "err" as const },
  ];
  const total = m?.accounts ?? null;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border px-5 py-4">
        <div><p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint">Produto · dados administrativos</p><h2 className="mt-1 font-semibold">Uso, contas e assinatura</h2></div>
        <p className="text-[11.5px] text-muted">{result.message}</p>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <dl className="grid grid-cols-2 divide-x divide-y divide-border border-border lg:border-r">
          {headline.map(([label, value]) => <div key={label} className="p-5"><dt className="text-[11.5px] text-muted">{label}</dt><dd className="mt-2 text-[26px] font-semibold leading-none tabular-nums">{value?.toLocaleString("pt-BR") ?? "—"}</dd></div>)}
        </dl>
        <div className="p-5">
          <p className="mb-3 text-[12px] text-muted">Proporção sobre {total?.toLocaleString("pt-BR") ?? "—"} contas</p>
          {total ? <BarRows label="Medidas de conta como proporção do total de contas" max={total}
            rows={shares.map((s) => ({ key: s.key, label: s.label, value: s.value ?? 0, display: s.value == null ? "—" : `${s.value.toLocaleString("pt-BR")} · ${Math.round((s.value / total) * 100)}%`, tone: s.value == null ? "idle" : s.tone }))} /> : <p className="text-xs text-muted">Total de contas indisponível.</p>}
        </div>
      </div>
      <p className="border-t border-border px-5 py-3 text-[10.5px] leading-relaxed text-faint">Fonte: API administrativa do app · tentativa {when(result.checkedAt)} · snapshot {when(result.data.generatedAt)}. Conta ativa, cortesia, ativação e pagamento são medidas distintas. — indica dado não disponível.</p>
    </Card>
  );
}
