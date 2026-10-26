import { Card } from "@/components/ui/card";
import { BarRows } from "@/components/ui/mini-charts";
import type { ProductMetrics } from "@/lib/product-metrics";
import { productMetrics, type ProductMetricsResult } from "@/server/product-metrics";

const when = (v: string) => new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
const num = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("pt-BR"));
const brl = (cents: number | null | undefined) => (cents == null ? "—" : (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

/** Dados administrativos do app no modelo de negócio dele: SaaS, marketplace, compra única ou créditos. */
export async function ProductAppMetrics({ product }: { product: string }) {
  const result = await productMetrics(product);
  if (!result.data) return <Card className="flex flex-wrap items-center gap-4 p-3"><div className="min-w-0 flex-1"><p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint">Dados do app · conexão pendente</p><h2 className="mt-1 text-sm font-semibold">Indicadores do negócio</h2><p className="mt-1 text-xs leading-relaxed text-muted">{result.message}</p></div><span className="rounded-full border border-border px-3 py-1 text-[11px] text-muted">Sem snapshot disponível</span></Card>;
  const data = result.data;
  if (data.marketplace) return <MarketplaceMetrics data={data} result={result} />;
  if (data.commerceFunnel) return <CommerceMetrics data={data} result={result} />;
  if (data.credits) return <CreditsMetrics data={data} result={result} />;
  return <AccountMetrics data={data} result={result} />;
}

function Footer({ result, data, note }: { result: ProductMetricsResult; data: ProductMetrics; note: string }) {
  return <p className="border-t border-border px-5 py-3 text-[10.5px] leading-relaxed text-faint">Fonte: agregados administrativos do app · conector configurado · tentativa {when(result.checkedAt)} · snapshot {when(data.generatedAt)}. {note} — indica dado não disponível.</p>;
}

function Header({ title, result }: { title: string; result: ProductMetricsResult }) {
  return <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border px-4 py-3">
    <div><p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint">Produto · dados administrativos</p><h2 className="mt-1 font-semibold">{title}</h2></div>
    <p className="text-[11.5px] text-muted">{result.message}</p>
  </div>;
}

function Tiles({ items }: { items: { label: string; value: string; hint?: string }[] }) {
  return <dl className="grid grid-cols-2 divide-x divide-y divide-border lg:grid-cols-4 lg:divide-y-0">
    {items.map((item) => <div key={item.label} className="p-3"><dt className="text-[11.5px] text-muted">{item.label}</dt><dd className="mt-1 text-xl font-semibold leading-none tabular-nums">{item.value}</dd>{item.hint && <dd className="mt-1.5 text-[11px] text-faint">{item.hint}</dd>}</div>)}
  </dl>;
}

function delta(current: number, previous: number) {
  if (!previous) return undefined;
  const pct = Math.round((current / previous - 1) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}% vs. mês anterior completo`;
}

function MarketplaceMetrics({ data, result }: { data: ProductMetrics; result: ProductMetricsResult }) {
  const m = data.marketplace!;
  const engagement = data.audience?.members;
  const cur = m.currentMonth, prev = m.previousMonth;
  return <Card className="overflow-hidden">
    <Header title="Marketplace: vendas, receita e produtores" result={result} />
    <Tiles items={[
      { label: "Faturamento bruto no mês", value: brl(cur.grossCents), hint: `${num(cur.paidItems)} vendas · anterior ${brl(prev.grossCents)}` },
      { label: "Receita da plataforma no mês", value: brl(cur.platformFeeCents), hint: delta(cur.platformFeeCents, prev.platformFeeCents) ?? `anterior ${brl(prev.platformFeeCents)}` },
      { label: "Produtores aprovados", value: num(m.producers.approved), hint: `de ${num(m.producers.onboarding)} com cadastro iniciado` },
      { label: "Usuários", value: num(m.users.total), hint: `${num(m.users.new30d)} novos em 30 dias` },
    ]} />
    <div className="border-t border-border p-3">
      <BarRows label="Produtores por etapa" max={m.producers.onboarding || 1} rows={[
        { key: "onboarding", label: "Cadastro iniciado", value: m.producers.onboarding, display: num(m.producers.onboarding), tone: "idle" as const },
        { key: "approved", label: "Aprovados para vender", value: m.producers.approved, display: `${num(m.producers.approved)}${m.producers.onboarding ? ` · ${Math.round((m.producers.approved / m.producers.onboarding) * 100)}%` : ""}`, tone: "accent" as const },
      ]} />
    </div>
    {engagement && <div className="space-y-3 border-t border-border p-3">
      <h3 className="text-xs font-semibold">Engajamento · {new Date(data.audience!.monthFrom).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", month: "long", year: "numeric" })} · {num(engagement.currentMonth.engaged)} usuários</h3>
      <dl className="grid grid-cols-3 gap-3 text-xs">{[["Criaram produto", engagement.currentMonth.creating], ["Fizeram venda", engagement.currentMonth.selling], ["Consumiram aulas", engagement.currentMonth.learning]].map(([label, value]) => <div key={label}><dt className="text-muted">{label}</dt><dd className="mt-1 font-semibold tabular-nums">{num(value as number)}</dd></div>)}</dl>
      <p className="text-[11px] text-faint">Pessoas distintas no total; os papéis podem se sobrepor. Reprodução observada desde {when(engagement.playbackObservedFrom)}, sem histórico anterior de tempo assistido. Não depende de marcar a aula como vista e não comprova conclusão.</p>
    </div>}
    <Footer result={result} data={data} note="Mês no fuso de São Paulo, mesma fonte do painel /plataforma do Members. Mês atual parcial; mês anterior completo. Receita da plataforma inclui produtos próprios e comissões, com valores conciliados ou estimados e estornos alocados conforme o relatório; não comprova liquidação nem saldo disponível. Marketplace não tem contas de assinatura." />
  </Card>;
}

const PLAN_NAMES = { basic: "Básico", advanced: "Advanced", premium: "Premium" } as const;

function CreditsMetrics({ data, result }: { data: ProductMetrics; result: ProductMetricsResult }) {
  const c = data.credits!;
  const sub = c.subscriptions, cr = c.credits;
  return <Card className="overflow-hidden">
    <Header title="Créditos: compras, assinaturas e consumo em 30 dias" result={result} />
    <Tiles items={[
      { label: "Receita registrada", value: brl(c.sales.revenueCents), hint: `${num(c.sales.count)} compras · ${num(c.sales.payingUsers)} compradores` },
      { label: "Assinaturas ativas", value: num(sub?.active), hint: sub ? `MRR estimado ${brl(sub.mrrCents)} · ${num(sub.trialing)} em teste` : "seção indisponível no admin" },
      { label: "Usuários ativos", value: num(c.users.active30d), hint: `de ${num(c.users.total)} · ${num(c.users.generating)} geraram` },
      { label: "Créditos consumidos", value: num(cr?.consumed), hint: cr ? `vendidos ${num(cr.sold)} · bônus ${num(cr.bonus)}` : "seção indisponível no admin" },
    ]} />
    {sub && sub.byPlan.length > 0 && <div className="border-t border-border p-3">
      <BarRows label="Assinaturas ativas por plano" max={sub.active || 1} rows={sub.byPlan.map((p) => ({ key: p.plan, label: PLAN_NAMES[p.plan], value: p.active, display: num(p.active), tone: "accent" as const }))} />
    </div>}
    <Footer result={result} data={data} note={`Janela móvel de 30 dias, mesma fonte da aba do admin do AG LABS App. ${num(c.generations)} gerações no período. Receita é o valor registrado das compras sem reembolso aprovado; não é liquidação. Créditos reembolsados: ${num(cr?.refunded)}. Modelo de créditos não tem contas SaaS.`} />
  </Card>;
}

function CommerceMetrics({ data, result }: { data: ProductMetrics; result: ProductMetricsResult }) {
  const f = data.commerceFunnel!;
  const events: [string, number | null][] = [["Visualizações de página", f.events.pageViews], ["Visualizações do preço", f.events.pricingViews], ["Cliques em chamadas", f.events.ctaClicks], ["Cliques em comprar", f.events.checkoutClicks], ["Checkouts criados", f.events.checkoutCreated], ["Falhas de checkout", f.events.checkoutFailures], ["Visitas à página de sucesso", f.events.successViews]];
  return <Card className="overflow-hidden">
    <Header title="Compra única: compras e funil de eventos" result={result} />
    <Tiles items={[
      { label: "Compras registradas", value: num(f.registeredPurchases) },
      { label: "Acessos provisionados", value: num(f.provisionedPurchases) },
      { label: "Valor em checkouts", value: brl(f.registeredCheckoutAmountCents), hint: "sem estornos e taxas" },
      { label: "Cliques em comprar", value: num(f.events.checkoutClicks) },
    ]} />
    <details className="border-t border-border px-4 py-3">
      <summary className="cursor-pointer text-xs font-medium">Eventos do funil</summary>
      <dl className="mt-3 space-y-1.5">{events.map(([label, value]) => <div key={label} className="flex justify-between gap-3 text-xs"><dt className="text-muted">{label}</dt><dd className="tabular-nums">{num(value)}</dd></div>)}</dl>
      <p className="mt-2 text-[11px] text-muted">Contagens anônimas, sem visitantes únicos nem taxa de conversão entre etapas. {f.observedFrom ? `Coleta iniciada em ${when(f.observedFrom)}.` : "Sem cobertura de eventos confirmada."}</p>
    </details>
    <Footer result={result} data={data} note={`Janela ${when(data.window.from)} a ${when(data.window.to)}. Valor registrado não é receita líquida ou liquidada.`} />
  </Card>;
}

function AccountMetrics({ data, result }: { data: ProductMetrics; result: ProductMetricsResult }) {
  const m = data.metrics;
  // Cada medida é independente: barras como fração das contas, nunca como partes de um todo.
  const shares = [
    { key: "ativas", label: "Ativas", value: m.activeAccounts, tone: "ok" as const },
    { key: "ativadas", label: "Ativadas", value: m.activatedAccounts, tone: "accent" as const },
    { key: "pagantes", label: "Assinaturas com acesso", value: m.payingAccounts, tone: "accent" as const },
    { key: "teste", label: "Em teste", value: m.trialAccounts, tone: "warn" as const },
    { key: "cortesias", label: "Cortesias", value: m.complimentaryAccounts, tone: "idle" as const },
    { key: "canceladas", label: "Canceladas", value: m.canceledAccounts, tone: "err" as const },
  ];
  const total = m.accounts;
  const funnel = data.activationFunnel;
  return <Card className="overflow-hidden">
    <Header title="Uso, contas e assinatura" result={result} />
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <dl className="grid grid-cols-2 divide-x divide-y divide-border border-border lg:border-r">
        {([["Usuários cadastrados", m.users], ["Contas / estabelecimentos", m.accounts], ["Assinaturas com acesso", m.payingAccounts], ["Em teste", m.trialAccounts]] as const).map(([label, value]) => <div key={label} className="p-3"><dt className="text-[11.5px] text-muted">{label}</dt><dd className="mt-1 text-xl font-semibold leading-none tabular-nums">{num(value)}</dd></div>)}
      </dl>
      <div className="p-3">
        <p className="mb-3 text-[12px] text-muted">Proporção sobre {num(total)} contas</p>
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
    <Footer result={result} data={data} note="Conta ativa, cortesia, ativação e pagamento são medidas distintas." />
  </Card>;
}
