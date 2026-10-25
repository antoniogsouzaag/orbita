import { Card } from "@/components/ui/card";
import { BarCompare } from "@/components/ui/revenue-charts-kpi";
import { ShareStrip, TONE_BG, type Tone } from "@/components/ui/mini-charts";
import { cn } from "@/lib/utils";
import {
  CRM_FUNNEL, CRM_ACCOUNTS, CRM_EMAIL_CATEGORIES, CRM_PIXEL_NOTE, CRM_PRODUCT_COVERAGE,
  type CrmAggregateResult, type CrmAggregateSummary, type CrmEmailFunnel,
} from "@/lib/crm-aggregates";
import { crmCommercialSummary, crmEmailFunnel } from "@/server/crm-commercial";
import { crmUrl } from "@/server/crm";

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ACCOUNT_LABELS = { trial: "Trial", trial_encerrado: "Trial encerrado", ativo: "Ativo", cancelado: "Cancelado" };
const ACCOUNT_TONES = { trial: "accent", trial_encerrado: "warn", ativo: "ok", cancelado: "err" } as const;
const EMAIL_LABELS = { enviados: "Enviados", entregues: "Entregues", abertos: "Abertos", cliques: "Com clique", respostas: "Com resposta", falhas: "Falhas", descadastros: "Descadastros" } as const;
const formatDate = (value: string) => new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

export async function ProductCommercial({ produto, dias = 30, categoria }: { produto: string; dias?: number; categoria?: typeof CRM_EMAIL_CATEGORIES[number] }) {
  const [summary, emails] = await Promise.all([crmCommercialSummary({ produto }), crmEmailFunnel({ produto, dias, categoria })]);
  return <CommercialPanels summary={summary} emails={emails} url={crmUrl()} />;
}

function Source({ result }: { result: CrmAggregateResult<unknown> }) {
  const checkedLabel = result.status === "not_configured" ? "Conexão verificada em" : result.status === "unavailable" ? "Tentativa em" : "Consultado em";
  return <p className="mt-3 text-[10px] leading-relaxed text-faint">Fonte: {result.source} · {checkedLabel} {formatDate(result.checkedAt)} · Atualização na origem não informada. — indica dado indisponível, não zero.</p>;
}

function Metrics({ items, compact = false }: { items: { label: string; value?: number | string | null; tone?: Tone }[]; compact?: boolean }) {
  return <dl className={cn("grid grid-cols-2 gap-2", compact ? "" : "sm:grid-cols-2 gap-2")}>{items.map((item) => <div key={item.label} className="rounded-xl bg-surface-2 p-3"><dt className="flex items-center gap-1.5 text-[11px] text-muted">{item.tone && <span aria-hidden className={cn("size-2 rounded-[3px]", TONE_BG[item.tone])} />}{item.label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{item.value ?? "—"}</dd></div>)}</dl>;
}

export function CommercialPanels({ summary, emails, url }: {
  summary: CrmAggregateResult<CrmAggregateSummary>; emails: CrmAggregateResult<CrmEmailFunnel>; url?: string | null;
}) {
  return <section aria-label="Comercial do produto" className="grid items-start gap-3 xl:grid-cols-2">
    <Card className="min-w-0 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-[14px] font-semibold tracking-tight">Funil comercial</h2>{url && <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent">Abrir CRM ↗</a>}</div>
      {summary.status !== "ok" || !summary.data ? <p role="status" className="mt-3 text-sm text-warning">{summary.message}</p> : <SummaryBody data={summary.data} />}
      <p className="mt-3 text-[11px] leading-relaxed text-muted">{CRM_PRODUCT_COVERAGE}</p>
      <Source result={summary} />
    </Card>
    <Card className="min-w-0 p-4">
      <h2 className="text-[14px] font-semibold tracking-tight">Funil de e-mails</h2>
      <p className="mt-1 text-xs text-muted">Janela selecionada · somente registros agregados do CRM.</p>
      {emails.status !== "ok" || !emails.data ? <p role="status" className="mt-3 text-sm text-warning">{emails.message}</p> : <EmailBody data={emails.data} />}
      <p className="mt-3 text-[11px] leading-relaxed text-muted">{CRM_PIXEL_NOTE} Cliques e respostas contam mensagens, não pessoas únicas. Não há envio ou automação nesta visão.</p>
      <Source result={emails} />
    </Card>
  </section>;
}

function SummaryBody({ data }: { data: CrmAggregateSummary }) {
  return <div className="mt-3 space-y-3">
    <Metrics items={[
      { label: "Oportunidades abertas", value: data.oportunidades_abertas },
      { label: "Clientes · etapa Cliente", value: data.clientes },
      { label: "Receita líquida do mês", value: data.receita_mes == null ? null : brl(data.receita_mes) },
      { label: "Base de prospecção", value: data.base_prospeccao },
      { label: "Pagantes identificados · mês", value: data.pagantes_mes },
      { label: "Pagamentos positivos · mês", value: data.pagamentos_mes },
      { label: "Pagamentos sem contato · mês", value: data.pagamentos_sem_contato_mes },
      { label: "Tarefas CRM vencidas", value: data.tarefas?.vencidas },
    ]} />
    <details className="text-[11px] text-muted"><summary className="cursor-pointer">Critérios dos indicadores</summary><p className="mt-2">Pagantes identificados são contatos distintos com pagamento BRL de saldo positivo no mês; não equivalem a assinaturas vigentes nem a todos os usuários do app. Etapa Cliente é a classificação comercial do CRM; não comprova pagamento ou cobrança atual. Não é inferida de trial ou conta ativa.{data.hoje && <> Data de referência do resumo: {data.hoje}.</>}</p></details>
    <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
      <div className="min-w-0">
        <h3 className="mb-3 text-[13px] font-medium">Etapas comerciais</h3>
        {data.funil ? <BarCompare horizontal height={150} xKey="etapa" description="Contatos do produto em cada etapa comercial" series={[{ key: "contatos", label: "Contatos" }]}
          data={CRM_FUNNEL.map((stage) => ({ etapa: stage, contatos: data.funil?.[stage] ?? null }))} /> : <p className="text-xs text-muted">Funil não informado.</p>}
      </div>
      <div className="min-w-0 space-y-3">
        <h3 className="text-[13px] font-medium">Contas no produto <span className="font-normal text-faint">· separadas do funil comercial</span></h3>
        {data.contas_no_produto && <ShareStrip className="h-2.5" label="Proporção das contas informadas por estado" parts={CRM_ACCOUNTS.filter((state) => data.contas_no_produto?.[state] != null).map((state) => ({ name: ACCOUNT_LABELS[state], value: data.contas_no_produto![state]!, tone: ACCOUNT_TONES[state] }))} />}
        <Metrics compact items={CRM_ACCOUNTS.map((state) => ({ label: ACCOUNT_LABELS[state], value: data.contas_no_produto?.[state], tone: ACCOUNT_TONES[state] }))} />
        {!data.contas_no_produto && <p className="text-xs text-muted">Contas não informadas nesta versão do CRM.</p>}
      </div>
    </div>
  </div>;
}

function EmailBody({ data }: { data: CrmEmailFunnel }) {
  const totals = data.total;
  const rates = [
    { label: "Entrega / enviados", value: totals?.taxa_entrega, base: totals?.enviados },
    { label: "Abertura / entregues", value: totals?.taxa_abertura, base: totals?.entregues },
    { label: "Clique / entregues", value: totals?.taxa_clique, base: totals?.entregues },
    { label: "Resposta / entregues", value: totals?.taxa_resposta, base: totals?.entregues },
  ];
  return <div className="mt-3 space-y-3">
    <Metrics items={[{label: "Aceitos sem entrega confirmada", value: data.aguardando_entrega}, {label: "Entregues sem resposta registrada", value: data.entregues_sem_resposta}, {label: "Entradas recebidas na janela", value: data.respostas_recebidas}, {label: "Agendados na janela", value: data.agendados_na_janela}]} />
    <p className="text-[11px] text-muted">Sem resposta registrada não significa desinteresse: depende da captura e correlação da caixa de entrada. Nenhum acompanhamento é disparado por esta tela.</p>
    {data.ultima_mensagem_em && <p className="text-[11px] text-faint">Última mensagem no período: {formatDate(data.ultima_mensagem_em)}</p>}
    {data.desde && <p className="text-[11px] text-faint">Desde {formatDate(data.desde)} · janela móvel de {data.dias} dias.</p>}
    {totals?.enviados === 0 && <p className="text-xs text-muted">Nenhum envio registrado para o produto nesta janela; isso não comprova ausência de envios fora do CRM.</p>}
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <h3 className="mb-3 text-[13px] font-medium">Do envio à resposta</h3>
        <BarCompare height={150} xKey="etapa" description="Mensagens do produto em cada etapa do funil de e-mails" series={[{ key: "mensagens", label: "Mensagens" }]}
          data={(["enviados", "entregues", "abertos", "cliques", "respostas"] as const).map((key) => ({ etapa: EMAIL_LABELS[key], mensagens: totals?.[key] ?? null }))} />
      </div>
      <div className="min-w-0 space-y-3">
        <h3 className="text-[13px] font-medium">Taxas</h3>
        <dl className="space-y-2.5">{rates.map((rate) => { const ok = rate.base && rate.value != null; return <div key={rate.label} className="text-xs"><div className="flex justify-between gap-3"><dt className="text-muted">{rate.label}</dt><dd className="font-medium tabular-nums">{ok ? `${rate.value!.toLocaleString("pt-BR")}%` : "—"}</dd></div><span aria-hidden className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full bg-[var(--chart-1)]" style={{ width: ok ? `${Math.min(100, rate.value!)}%` : 0 }} /></span></div>; })}</dl>
      </div>
    </div>
    <dl className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border pt-3 text-xs">{Object.entries(EMAIL_LABELS).map(([key, label]) => <div key={key} className="flex gap-1.5"><dt className="text-muted">{label}</dt><dd className="font-medium tabular-nums">{totals?.[key as keyof typeof EMAIL_LABELS] ?? "—"}</dd></div>)}</dl>
    <p className="text-[11px] text-muted">Taxas sem denominador disponível aparecem como —, nunca como 0%. Entrega usa enviados; as demais usam entregues.</p>
    <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted"><div><dt className="inline">Campanhas: </dt><dd className="inline tabular-nums">{data.campanhas ?? "—"}</dd></div><div><dt className="inline">Respostas recebidas (inbound): </dt><dd className="inline tabular-nums">{data.respostas_recebidas ?? "—"}</dd></div></dl>
    <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-xs font-medium">Categorias e origens de envio</summary><div className="mt-3 max-h-72 space-y-3 overflow-auto">
    {!!data.por_categoria && <div className="overflow-x-auto"><table className="w-full text-left text-xs"><caption className="mb-2 text-left text-muted">Categorias retornadas pelo CRM</caption><thead className="text-faint"><tr><th className="py-2 font-normal">Categoria</th><th className="font-normal">Enviados</th><th className="font-normal">Entregues</th><th className="font-normal">Respostas</th></tr></thead><tbody>{CRM_EMAIL_CATEGORIES.filter((category) => data.por_categoria?.[category]).map((category) => <tr key={category} className="border-t border-border"><th className="py-2 font-normal">{category}</th><td>{data.por_categoria?.[category]?.enviados ?? "—"}</td><td>{data.por_categoria?.[category]?.entregues ?? "—"}</td><td>{data.por_categoria?.[category]?.respostas ?? "—"}</td></tr>)}</tbody></table></div>}
    {!!data.por_origem?.length && <div className="overflow-x-auto"><table className="w-full text-left text-xs"><caption className="mb-3 text-left font-medium">Origens de envio · até 15 com maior volume</caption><thead className="text-faint"><tr>{["Origem", "Enviados", "Entregues", "Respostas", "Falhas", "Descadastros"].map(label => <th className="py-2 pr-3 font-normal" key={label}>{label}</th>)}</tr></thead><tbody>{data.por_origem.map((source, i) => <tr key={`${source.origem}:${i}`} className="border-t border-border"><th className="max-w-52 break-words py-3 pr-3 font-normal">{source.origem}</th><td>{source.enviados ?? "—"}</td><td>{source.entregues ?? "—"}</td><td>{source.respostas ?? "—"}</td><td>{source.falhas ?? "—"}</td><td>{source.descadastros ?? "—"}</td></tr>)}</tbody></table></div>}
    </div></details>
  </div>;
}
