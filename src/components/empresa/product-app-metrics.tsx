import { Card } from "@/components/ui/card";
import { BarRows } from "@/components/ui/mini-charts";
import { productMetrics } from "@/server/product-metrics";

const when = (v: string) => new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

export async function ProductAppMetrics({ product }: { product: string }) {
  const result = await productMetrics(product);
  if (!result.data) return <Card className="flex flex-wrap items-center gap-4 p-3"><div className="min-w-0 flex-1"><p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint">Dados do app · conexão pendente</p><h2 className="mt-1 text-sm font-semibold">Uso, contas e assinaturas</h2><p className="mt-1 text-xs leading-relaxed text-muted">{result.message}</p></div><span className="rounded-full border border-border px-3 py-1 text-[11px] text-muted">Sem snapshot disponível</span></Card>;
  const m = result.data.metrics;
  const headline = [["Usuários cadastrados", m?.users], ["Contas / estabelecimentos", m?.accounts], ["Assinaturas com acesso", m?.payingAccounts], ["Em teste", m?.trialAccounts]] as const;
  // Cada medida é independente: barras como fração das contas, nunca como partes de um todo.
  const shares = [
    { key: "ativas", label: "Ativas", value: m?.activeAccounts, tone: "ok" as const },
    { key: "ativadas", label: "Ativadas", value: m?.activatedAccounts, tone: "accent" as const },
    { key: "pagantes", label: "Assinaturas com acesso", value: m?.payingAccounts, tone: "accent" as const },
    { key: "teste", label: "Em teste", value: m?.trialAccounts, tone: "warn" as const },
    { key: "cortesias", label: "Cortesias", value: m?.complimentaryAccounts, tone: "idle" as const },
    { key: "canceladas", label: "Canceladas", value: m?.canceledAccounts, tone: "err" as const },
  ];
  const total = m?.accounts ?? null;
  const funnel = result.data.activationFunnel;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border px-4 py-3">
        <div><p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint">Produto · dados administrativos</p><h2 className="mt-1 font-semibold">Uso, contas e assinatura</h2></div>
        <p className="text-[11.5px] text-muted">{result.message}</p>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <dl className="grid grid-cols-2 divide-x divide-y divide-border border-border lg:border-r">
          {headline.map(([label, value]) => <div key={label} className="p-3"><dt className="text-[11.5px] text-muted">{label}</dt><dd className="mt-1 text-xl font-semibold leading-none tabular-nums">{value?.toLocaleString("pt-BR") ?? "—"}</dd></div>)}
        </dl>
        <div className="p-3">
          <p className="mb-3 text-[12px] text-muted">Proporção sobre {total?.toLocaleString("pt-BR") ?? "—"} contas</p>
          {total ? <BarRows label="Medidas de conta como proporção do total de contas" max={total}
            rows={shares.map((s) => ({ key: s.key, label: s.label, value: s.value ?? 0, display: s.value == null ? "—" : `${s.value.toLocaleString("pt-BR")} · ${Math.round((s.value / total) * 100)}%`, tone: s.value == null ? "idle" : s.tone }))} /> : <p className="text-xs text-muted">Total de contas indisponível.</p>}
        </div>
      </div>
      {funnel && total != null && <details className="border-t border-border px-4 py-3">
        <summary className="cursor-pointer text-xs font-medium">Ativação · {(funnel.readyForBooking - funnel.firstAppointment).toLocaleString("pt-BR")} contas prontas sem reserva</summary>
        <div className="mt-3"><BarRows label="Etapas cumulativas de ativação por conta" max={total || 1} rows={[
          { key: "professional", label: "Profissional ativo", value: funnel.professional },
          { key: "catalog", label: "Com serviços", value: funnel.catalog },
          { key: "ready", label: "Prontas para agendar", value: funnel.readyForBooking },
          { key: "first", label: "Agenda iniciada", value: funnel.firstAppointment },
        ].map(row => ({ ...row, display: `${row.value.toLocaleString("pt-BR")} / ${total.toLocaleString("pt-BR")}`, tone: "accent" as const }))} /></div>
        <p className="mt-2 text-[11px] text-muted">Estoque atual, com etapas na mesma unidade e filiais consolidadas. Não é conversão de campanha, coorte ou período.</p>
      </details>}
      <p className="border-t border-border px-5 py-3 text-[10.5px] leading-relaxed text-faint">Fonte: agregados administrativos do app · coleta pelo conector configurado · tentativa {when(result.checkedAt)} · snapshot {when(result.data.generatedAt)}. Conta ativa, cortesia, ativação e pagamento são medidas distintas. — indica dado não disponível.</p>
    </Card>
  );
}
