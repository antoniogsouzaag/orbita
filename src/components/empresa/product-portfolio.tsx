import { BadgeDollarSign, Sparkles, Target, Users } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ShareStrip, Legend } from "@/components/ui/mini-charts";
import { BarCompare, ChartCard, DonutBreakdown, KpiCard } from "@/components/ui/revenue-charts-kpi";
import { CRM_FUNNEL } from "@/lib/crm-aggregates";
import { crmCommercialSummary } from "@/server/crm-commercial";

const NAMES: Record<string, string> = { barberias: "Barberias", mecard: "MeCard", members: "Members", membros: "Members", viajeki: "Viajeki", aglabs: "AG LABS", "ag-labs": "AG LABS", sem_produto: "A definir" };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = (v?: number | null) => (v == null ? "—" : v.toLocaleString("pt-BR"));

/** Visão do negócio: indicadores, gráficos e produtos a partir do resumo agregado do CRM. */
export async function ProductPortfolio() {
  const result = await crmCommercialSummary();
  const data = result.data;
  const products = Object.entries(data?.por_produto ?? {});
  const named = products.map(([key, p]) => ({ key, name: NAMES[key] ?? key, ...p }));
  const checked = new Date(result.checkedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const revenueDelta = data?.receita_mes != null && data.receita_mes_anterior ? data.receita_mes / data.receita_mes_anterior - 1 : undefined;
  const funnel = CRM_FUNNEL.map((stage) => ({ etapa: stage, contatos: data?.funil?.[stage] ?? null })).filter((row) => row.contatos !== null);
  const byProduct = named.filter((p) => p.key !== "sem_produto" || (p.oportunidades_abertas ?? 0) + (p.clientes ?? 0) > 0)
    .map((p) => ({ produto: p.name, oportunidades: p.oportunidades_abertas ?? null, clientes: p.clientes ?? null, novos: p.novos_30d ?? null }));
  const base = named.filter((p) => (p.base_prospeccao ?? 0) > 0).map((p, i) => ({ label: p.name, value: p.base_prospeccao ?? 0, slot: (((i % 5) + 1) as 1 | 2 | 3 | 4 | 5) }));
  const accounts = named.filter((p) => p.contas).map((p) => ({ produto: p.name, ativas: p.contas?.ativo ?? null, teste: p.contas?.trial ?? null, encerradas: p.contas?.trial_encerrado ?? null, canceladas: p.contas?.cancelado ?? null }));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Ecossistema · CRM</p>
          <h2 className="mt-1 text-[17px] font-semibold tracking-tight">Visão do negócio</h2>
        </div>
        <p className="text-[11.5px] text-faint">Consulta {checked}</p>
      </div>

      {!data ? (
        <Card className="p-5 text-[13px] text-muted">{result.message ?? "O CRM não retornou o resumo nesta consulta."}</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard icon={<BadgeDollarSign />} label="Receita líquida do mês" value={data.receita_mes == null ? "—" : brl(data.receita_mes)} delta={revenueDelta} period="vs mês anterior" hint={revenueDelta === undefined ? "Pagamentos registrados no CRM" : undefined} />
            <KpiCard icon={<Target />} label="Oportunidades abertas" value={num(data.oportunidades_abertas)} hint={data.contatos_a_qualificar != null ? `${num(data.contatos_a_qualificar)} a qualificar` : "Funil sem a base fria"} />
            <KpiCard icon={<Users />} label="Clientes no funil" value={num(data.clientes)} hint={data.pagantes_mes != null ? `${num(data.pagantes_mes)} pagantes no mês` : "Etapa Cliente do CRM"} />
            <KpiCard icon={<Sparkles />} label="Novos contatos · 30 dias" value={num(data.novos_30d)} hint={data.novos_7d != null ? `${num(data.novos_7d)} nos últimos 7 dias` : undefined} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {byProduct.length > 0 && (
              <ChartCard title="Funil por produto" subtitle="Oportunidades, clientes e novos em 30 dias">
                <BarCompare data={byProduct} xKey="produto" height={230} description="Oportunidades abertas, clientes e novos contatos em 30 dias por produto"
                  series={[{ key: "oportunidades", label: "Oportunidades" }, { key: "clientes", label: "Clientes" }, { key: "novos", label: "Novos · 30d" }]} />
              </ChartCard>
            )}
            {funnel.length > 0 && (
              <ChartCard title="Etapas comerciais" subtitle="Contatos em cada etapa, todos os produtos">
                <BarCompare data={funnel} xKey="etapa" height={230} horizontal description="Contatos por etapa do funil comercial" series={[{ key: "contatos", label: "Contatos" }]} />
              </ChartCard>
            )}
            {accounts.length > 0 && (
              <ChartCard title="Contas nos produtos" subtitle="Estado das contas registradas no CRM · não comprova pagamento">
                <BarCompare data={accounts} xKey="produto" height={230} stacked description="Contas por estado em cada produto"
                  series={[{ key: "ativas", label: "Ativas", slot: 3 }, { key: "teste", label: "Em teste", slot: 1 }, { key: "encerradas", label: "Teste encerrado", slot: 4 }, { key: "canceladas", label: "Canceladas", slot: 2 }]} />
              </ChartCard>
            )}
            {base.length > 0 && (
              <ChartCard title="Base de prospecção" subtitle="Contatos frios, separados das oportunidades">
                <DonutBreakdown data={base} centerLabel="Contatos" description="Base de prospecção por produto" />
              </ChartCard>
            )}
          </div>
        </>
      )}

      {named.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Produtos em acompanhamento</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {named.map((p) => {
              const ativos = p.contas?.ativo ?? 0, trial = p.contas?.trial ?? 0, outros = (p.contas?.trial_encerrado ?? 0) + (p.contas?.cancelado ?? 0);
              const body = (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="truncate text-[14px] font-semibold">{p.name}</h4>
                    <span className="text-[11px] text-faint">{p.key === "barberias" ? <span className="text-accent">Abrir ↗</span> : `CRM · ${p.key}`}</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-4 gap-2">
                    {[["Oport.", p.oportunidades_abertas], ["Clientes", p.clientes], ["Base", p.base_prospeccao], ["Novos", p.novos_30d]].map(([label, value]) => (
                      <div key={String(label)} className="min-w-0"><dt className="truncate text-[10.5px] text-faint">{label}</dt><dd className="mt-0.5 text-[16px] font-semibold tabular-nums">{num(value as number | undefined)}</dd></div>
                    ))}
                  </dl>
                  {p.contas ? (
                    <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                      <ShareStrip label={`Contas: ${ativos} ativas, ${trial} em teste, ${outros} encerradas ou canceladas`} parts={[{ name: "Ativas", value: ativos, tone: "ok" }, { name: "Em teste", value: trial, tone: "accent" }, { name: "Encerradas", value: outros, tone: "idle" }]} />
                      <Legend items={[{ name: "ativas", tone: "ok", value: ativos }, { name: "teste", tone: "accent", value: trial }, { name: "encerradas", tone: "idle", value: outros }]} />
                    </div>
                  ) : <p className="mt-3 border-t border-border pt-3 text-[11px] text-faint">Contas não informadas.</p>}
                </>
              );
              return p.key === "barberias"
                ? <Link key={p.key} href="/empresa/negocios/barberias" className="card block p-4 transition hover:border-border-strong">{body}</Link>
                : <Card key={p.key} className="p-4">{body}</Card>;
            })}
          </div>
        </div>
      )}
      <p className="text-[11px] leading-relaxed text-faint">Fonte: CRM MCP · atualização na origem não informada. Cobertura limitada aos produtos presentes no CRM; contas não comprovam pagamento. — indica dado indisponível, não zero.</p>
    </section>
  );
}
