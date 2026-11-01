import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Mail, TrendingUp } from "lucide-react";
import { CRM_FUNNEL } from "@/lib/crm-aggregates";
import { BUSINESS_UNITS } from "@/lib/business-models";
import { businessAudience } from "@/lib/business-audience";
import { crmKeyForUnit } from "@/lib/business-crm";
import { crmCommercialSummary, crmEmailFunnel, crmPrioritySummary } from "@/server/crm-commercial";
import { productMetrics } from "@/server/product-metrics";

const number = (value?: number | null) => value == null ? "—" : value.toLocaleString("pt-BR");
const money = (value?: number) => value === undefined ? "—" : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const timestamp = (value: string) => new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export async function JournalCommercialPulse() {
  const [summary, emails, priorities] = await Promise.all([crmCommercialSummary(), crmEmailFunnel({ dias: 1 }), crmPrioritySummary()]);
  const data = summary.status === "ok" ? summary.data : null;
  const email = emails.status === "ok" ? emails.data : null;
  const opportunities = priorities.status === "ok" ? priorities.data : null;
  return <section aria-labelledby="journal-business" className="space-y-4 rounded-2xl border border-border bg-surface/70 p-5 sm:p-6">
    <div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-accent">Da origem, agora</p><h2 id="journal-business" className="mt-2 text-lg font-semibold">O negócio em movimento</h2></div><TrendingUp className="size-5 text-muted" /></div>
    {!data ? <p className="text-xs text-muted">Resumo comercial {summary.status === "not_configured" ? "não conectado" : "indisponível"}. Ausência de coleta não é zero.</p> : <>
      <div className="grid grid-cols-2 gap-3 border-y border-border py-4"><div><p className="text-[11px] text-muted">Receita registrada · mês</p><p className="mt-1 text-xl font-semibold">{money(data.receita_mes)}</p></div><div><p className="text-[11px] text-muted">Pagamentos · mês</p><p className="mt-1 text-xl font-semibold">{number(data.pagamentos_mes)}</p></div></div>
      <p className="text-[11px] text-muted">{number(data.pagantes_mes)} pagantes no mês · transações não são pessoas. Valores do CRM não comprovam liquidação.</p>
      <div><p className="mb-3 text-xs font-medium">Funil comercial</p><dl className="space-y-2 text-xs">{CRM_FUNNEL.map(stage => <div key={stage} className="flex justify-between gap-3"><dt className="text-muted">{stage}</dt><dd className="font-medium tabular-nums">{number(data.funil?.[stage])}</dd></div>)}</dl></div>
      <p className="text-[11px] text-muted">{number(data.novos_7d)} novos contatos em 7 dias. Contato novo não significa lead qualificado; base fria fica fora do funil.</p>
      {!!data.agrupamentos_sem_slug && <p className="rounded-xl border border-warning/20 bg-warning/5 p-3 text-[11px] leading-relaxed text-warning">{data.agrupamentos_sem_slug} agrupamento(s) legado(s) sem identificador válido de produto ficaram fora do detalhamento por negócio. Os totais globais foram preservados; a classificação precisa ser revisada no CRM.</p>}
    </>}
    <div className="border-t border-border pt-4"><h3 className="mb-2 flex items-center gap-2 text-xs font-medium"><Mail className="size-3.5" />E-mails · últimas 24 horas</h3>
      {!email ? <p className="text-xs text-muted">Coleta {emails.status === "not_configured" ? "não conectada" : "indisponível"}. Nenhuma ausência de e-mails foi presumida.</p> : <>
        <div className="grid grid-cols-3 gap-2 text-center">{[["Enviados", email.total?.enviados], ["Entregues", email.total?.entregues], ["Respostas", email.total?.respostas]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-surface-2 px-2 py-3"><p className="text-lg font-semibold">{number(value as number | undefined)}</p><p className="text-[10px] text-muted">{label}</p></div>)}</div>
        <p className="mt-3 text-[11px] text-muted">{number(email.total?.falhas)} falhas · {number(email.aguardando_entrega)} aguardando entrega · janela desde {email.desde ? timestamp(email.desde) : "não informada"}.</p>
        {email.ultima_mensagem_em && <p className="mt-2 text-[10px] text-faint">Última mensagem registrada: {timestamp(email.ultima_mensagem_em)}. Entregues sem resposta na janela: {number(email.entregues_sem_resposta)}.</p>}
      </>}
      <p className="mt-2 text-[11px] leading-relaxed text-faint">Mede o registro de envios do CRM, não a saúde de todas as caixas de entrada. Triagem de infraestrutura e suporte são fontes diferentes.</p>
    </div>
    <div className="border-t border-border pt-4"><h3 className="mb-2 text-xs font-medium">Próximos passos comerciais</h3>{opportunities ? <ul className="space-y-2 text-xs text-muted"><li>{number(opportunities.tarefas_vencidas)} tarefas vencidas</li><li>{number(opportunities.sem_proximo_passo)} oportunidades sem tarefa pendente</li><li>{number(opportunities.testes_encerrados)} testes encerrados confirmados</li></ul> : <p className="text-xs text-muted">Prioridades não disponíveis nesta consulta.</p>}<p className="mt-2 text-[11px] text-faint">Uma oportunidade pode aparecer em mais de um sinal. Acompanhamento é feito no CRM.</p></div>
    <Link href="/empresa/negocios" className="flex items-center justify-between rounded-xl bg-surface-2 p-3 text-xs font-medium">Ver negócios e e-mails<ArrowUpRight className="size-3.5" /></Link>
    <p className="text-[10px] leading-relaxed text-faint">Fonte: CRM MCP · resumo {timestamp(summary.checkedAt)} · e-mails {timestamp(emails.checkedAt)} · prioridades {timestamp(priorities.checkedAt)}. Atualização interna da origem não informada.</p>
  </section>;
}

export async function JournalProductPulse() {
  const rows = await Promise.all(BUSINESS_UNITS.map(async unit => ({ unit, result: await productMetrics(crmKeyForUnit(unit.id)) })));
  return <section className="rounded-2xl border border-border bg-surface/70 p-5 sm:p-6" aria-labelledby="journal-products">
    <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-accent">Sinais de uso</p><h2 id="journal-products" className="mt-2 text-lg font-semibold">Quem chegou por aqui</h2>
    <p className="mt-2 text-xs leading-relaxed text-muted">Cadastros novos no mês, por aplicativo. São contas independentes; não são pessoas únicas entre produtos.</p>
    <div className="mt-4 divide-y divide-border">{rows.map(({ unit, result }) => {
      const audience = businessAudience(result);
      return <Link key={unit.id} href={`/empresa/negocios/${unit.id}`} className="flex items-center gap-3 py-3">
        <Image src={unit.logo} alt="" width={28} height={28} className="size-7 rounded-md object-contain" />
        <span className="min-w-0 flex-1"><span className="block text-xs font-medium">{unit.name}</span><span className="block text-[10px] text-faint">{result.status === "ok" ? result.data ? `Fonte gerada em ${timestamp(result.data.generatedAt)}` : "Sem snapshot" : result.status === "stale" ? "Snapshot desatualizado" : "Coleta indisponível"}</span></span>
        <span className="text-right"><span className="block text-sm font-semibold tabular-nums">{number(audience.newMonth)}</span><span className="block text-[10px] text-faint">no mês</span></span>
      </Link>;
    })}</div>
    <p className="mt-3 text-[10px] leading-relaxed text-faint">Apps → CRM → Órbita. “—” indica ausência de dado válido, não zero. Novos no dia ainda exigem uma série diária na origem.</p>
  </section>;
}
