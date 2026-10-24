import { Card } from "@/components/ui/card";
import {
  CRM_FUNNEL, CRM_ACCOUNTS, CRM_EMAIL_CATEGORIES, CRM_PIXEL_NOTE, CRM_PRODUCT_COVERAGE,
  type CrmAggregateResult, type CrmAggregateSummary, type CrmEmailFunnel,
} from "@/lib/crm-aggregates";
import { crmCommercialSummary, crmEmailFunnel } from "@/server/crm-commercial";
import { crmUrl } from "@/server/crm";

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ACCOUNT_LABELS = { trial: "Trial", trial_encerrado: "Trial encerrado", ativo: "Ativo", cancelado: "Cancelado" };
const EMAIL_LABELS = { enviados: "Enviados", entregues: "Entregues", abertos: "Abertos", cliques: "Com clique", respostas: "Com resposta", falhas: "Falhas", descadastros: "Descadastros" } as const;
const formatDate = (value: string) => new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

export async function ProductCommercial({ produto, dias = 30, categoria }: { produto: string; dias?: number; categoria?: typeof CRM_EMAIL_CATEGORIES[number] }) {
  const [summary, emails] = await Promise.all([crmCommercialSummary({ produto }), crmEmailFunnel({ produto, dias, categoria })]);
  return <CommercialPanels summary={summary} emails={emails} url={crmUrl()} />;
}

function Source({ result }: { result: CrmAggregateResult<unknown> }) {
  const checkedLabel = result.status === "not_configured" ? "Conexão verificada em" : result.status === "unavailable" ? "Tentativa em" : "Consultado em";
  return <p className="mt-4 text-[10px] leading-relaxed text-faint">Fonte: {result.source} · {checkedLabel} {formatDate(result.checkedAt)} · Atualização na origem não informada. — indica dado indisponível, não zero.</p>;
}

function Metrics({ items }: { items: { label: string; value?: number | string | null }[] }) {
  return <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{items.map((item) => <div key={item.label} className="rounded-xl bg-surface-2 p-3"><dt className="text-[11px] text-muted">{item.label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{item.value ?? "—"}</dd></div>)}</dl>;
}

export function CommercialPanels({ summary, emails, url }: {
  summary: CrmAggregateResult<CrmAggregateSummary>; emails: CrmAggregateResult<CrmEmailFunnel>; url?: string | null;
}) {
  return <section aria-label="Comercial do produto" className="space-y-5">
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Funil comercial</h2>{url && <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent">Abrir CRM ↗</a>}</div>
      {summary.status !== "ok" || !summary.data ? <p role="status" className="mt-4 text-sm text-warning">{summary.message}</p> : <SummaryBody data={summary.data} />}
      <p className="mt-4 text-[11px] leading-relaxed text-muted">{CRM_PRODUCT_COVERAGE}</p>
      <Source result={summary} />
    </Card>
    <Card className="p-5">
      <h2 className="font-semibold">Funil de e-mails</h2>
      <p className="mt-1 text-xs text-muted">Janela selecionada · somente registros agregados do CRM.</p>
      {emails.status !== "ok" || !emails.data ? <p role="status" className="mt-4 text-sm text-warning">{emails.message}</p> : <EmailBody data={emails.data} />}
      <p className="mt-4 text-[11px] leading-relaxed text-muted">{CRM_PIXEL_NOTE} Cliques e respostas contam mensagens, não pessoas únicas. Não há envio ou automação nesta visão.</p>
      <Source result={emails} />
    </Card>
  </section>;
}

function SummaryBody({ data }: { data: CrmAggregateSummary }) {
  const max = Math.max(1, ...Object.values(data.funil ?? {}).filter((value): value is number => value !== undefined));
  return <div className="mt-4 space-y-4">
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
    <p className="text-[11px] text-muted">Pagantes identificados são contatos distintos com pagamento BRL de saldo positivo no mês; não equivalem a assinaturas vigentes nem a todos os usuários do app. Etapa Cliente é a classificação comercial do CRM; não comprova pagamento ou cobrança atual. Não é inferida de trial ou conta ativa.{data.hoje && <> Data de referência do resumo: {data.hoje}.</>}</p>
    <ol className="space-y-2" aria-label="Etapas comerciais">{CRM_FUNNEL.map((stage) => {
      const value = data.funil?.[stage];
      return <li key={stage} className="flex items-center gap-3 text-xs"><span className="w-24 shrink-0 text-muted">{stage}</span><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">{value !== undefined && <span className="block h-full rounded-full bg-accent/70" style={{ width: `${(value / max) * 100}%` }} />}</span><span className="w-8 text-right tabular-nums">{value ?? "—"}</span></li>;
    })}</ol>
    <div className="border-t border-border pt-4"><h3 className="mb-3 text-sm font-medium">Contas no produto · separadas do funil comercial</h3>
      <Metrics items={CRM_ACCOUNTS.map((state) => ({ label: ACCOUNT_LABELS[state], value: data.contas_no_produto?.[state] }))} />
      {!data.contas_no_produto && <p className="mt-2 text-xs text-muted">Contas não informadas nesta versão do CRM.</p>}
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
  return <div className="mt-4 space-y-4">
    <Metrics items={[{label: "Aceitos sem entrega confirmada", value: data.aguardando_entrega}, {label: "Entregues sem resposta registrada", value: data.entregues_sem_resposta}, {label: "Entradas recebidas na janela", value: data.respostas_recebidas}, {label: "Agendados na janela", value: data.agendados_na_janela}]} />
    <p className="text-[11px] text-muted">Sem resposta registrada não significa desinteresse: depende da captura e correlação da caixa de entrada. Nenhum acompanhamento é disparado por esta tela.</p>
    {data.ultima_mensagem_em && <p className="text-[11px] text-faint">Última mensagem no período: {formatDate(data.ultima_mensagem_em)}</p>}
    {data.desde && <p className="text-[11px] text-faint">Desde {formatDate(data.desde)} · janela móvel de {data.dias} dias.</p>}
    {totals?.enviados === 0 && <p className="text-xs text-muted">Nenhum envio registrado para o produto nesta janela; isso não comprova ausência de envios fora do CRM.</p>}
    <Metrics items={Object.entries(EMAIL_LABELS).map(([key, label]) => ({ label, value: totals?.[key as keyof typeof EMAIL_LABELS] }))} />
    <Metrics items={rates.map((rate) => ({ label: rate.label, value: rate.base && rate.value != null ? `${rate.value.toLocaleString("pt-BR")}%` : null }))} />
    <p className="text-[11px] text-muted">Taxas sem denominador disponível aparecem como —, nunca como 0%. Entrega usa enviados; as demais usam entregues.</p>
    <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted"><div><dt className="inline">Campanhas: </dt><dd className="inline tabular-nums">{data.campanhas ?? "—"}</dd></div><div><dt className="inline">Respostas recebidas (inbound): </dt><dd className="inline tabular-nums">{data.respostas_recebidas ?? "—"}</dd></div></dl>
    {!!data.por_categoria && <div className="overflow-x-auto"><table className="w-full text-left text-xs"><caption className="mb-2 text-left text-muted">Categorias retornadas pelo CRM</caption><thead className="text-faint"><tr><th className="py-2 font-normal">Categoria</th><th className="font-normal">Enviados</th><th className="font-normal">Entregues</th><th className="font-normal">Respostas</th></tr></thead><tbody>{CRM_EMAIL_CATEGORIES.filter((category) => data.por_categoria?.[category]).map((category) => <tr key={category} className="border-t border-border"><th className="py-2 font-normal">{category}</th><td>{data.por_categoria?.[category]?.enviados ?? "—"}</td><td>{data.por_categoria?.[category]?.entregues ?? "—"}</td><td>{data.por_categoria?.[category]?.respostas ?? "—"}</td></tr>)}</tbody></table></div>}
    {!!data.por_origem?.length && <div className="overflow-x-auto"><table className="w-full text-left text-xs"><caption className="mb-3 text-left font-medium">Origens de envio · até 15 com maior volume</caption><thead className="text-faint"><tr>{["Origem", "Enviados", "Entregues", "Respostas", "Falhas", "Descadastros"].map(label => <th className="py-2 pr-3 font-normal" key={label}>{label}</th>)}</tr></thead><tbody>{data.por_origem.map((source, i) => <tr key={`${source.origem}:${i}`} className="border-t border-border"><th className="max-w-52 break-words py-3 pr-3 font-normal">{source.origem}</th><td>{source.enviados ?? "—"}</td><td>{source.entregues ?? "—"}</td><td>{source.respostas ?? "—"}</td><td>{source.falhas ?? "—"}</td><td>{source.descadastros ?? "—"}</td></tr>)}</tbody></table></div>}
  </div>;
}
