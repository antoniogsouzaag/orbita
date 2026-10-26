import { Activity, ArrowUpRight, BadgeDollarSign, Sparkles, Target, UserPlus, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { BarCompare, ChartCard, DonutBreakdown, KpiCard } from "@/components/ui/revenue-charts-kpi";
import { CRM_FUNNEL } from "@/lib/crm-aggregates";
import { crmCommercialSummary } from "@/server/crm-commercial";
import { productMetrics } from "@/server/product-metrics";
import { BUSINESS_UNITS, MODEL_INFO } from "@/lib/business-models";
import { businessAudience, sumBusinessAudience } from "@/lib/business-audience";

const NAMES: Record<string, string> = { barberias: "Barberias", mecard: "MeCard", members: "Members", membros: "Members", viajeki: "Viajeki", aglabs: "AG LABS", "ag-labs": "AG LABS", localsite: "Desenvolvimento web", "local-site": "Desenvolvimento web", desenvolvimento_web: "Desenvolvimento web", sem_produto: "A definir" };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = (v?: number | null) => (v == null ? "—" : v.toLocaleString("pt-BR"));

/** Visão do negócio: indicadores, gráficos e produtos a partir do resumo agregado do CRM. */
export async function ProductPortfolio() {
  const [result, snapshots] = await Promise.all([
    crmCommercialSummary(),
    Promise.all(BUSINESS_UNITS.map(async unit => ({ ...unit, result: await productMetrics(unit.id) }))),
  ]);
  const now = Date.parse(result.checkedAt);
  const audience = sumBusinessAudience(snapshots.filter(unit => unit.model !== "compra_unica"), now);
  const partialPlayback = snapshots.some(unit => unit.result.status === "ok" && unit.result.data?.audience?.members && Date.parse(unit.result.data.audience.members.playbackObservedFrom) > Date.parse(unit.result.data.audience.activityFrom));
  const coverage = (metric: typeof audience.total) => `${metric.covered} de ${metric.products} aplicativos${metric.covered < metric.products ? " · soma parcial" : ""}`;
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
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Ecossistema · CRM</p>
          <h2 className="mt-1 text-[17px] font-semibold tracking-tight">Visão do negócio</h2>
        </div>
        <p className="text-[11.5px] text-faint">Consulta {checked}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard icon={<Users />} label="Usuários totais" value={num(audience.total.value)} hint={coverage(audience.total)} />
        <KpiCard icon={<Activity />} label="Usuários ativos · 30 dias" value={num(audience.active.value)} hint={`${coverage(audience.active)}${partialPlayback ? " · coleta de aulas parcial" : ""}`} />
        <KpiCard icon={<UserPlus />} label="Novos usuários no mês" value={num(audience.newMonth.value)} hint={coverage(audience.newMonth)} />
      </div>
      <p className="text-[11px] leading-relaxed text-faint">Soma dos cadastros nos aplicativos, sem deduplicar a mesma pessoa entre produtos. Ativos registraram atividade no produto nos últimos 30 dias. Novos: mês atual em São Paulo. Dados ausentes ou desatualizados ficam fora da soma. VibeKit é acompanhado por compras, sem contagem de usuários.</p>

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

      {snapshots.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Produtos em acompanhamento</h3><p className="text-[11px] text-faint">Usuários do app e oportunidades do CRM</p></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {snapshots.map((p) => {
              const users = businessAudience(p.result, now);
              const engagement = p.result.status === "ok" ? p.result.data?.audience?.members : undefined;
              const commerce = p.result.status === "ok" ? p.result.data?.commerceFunnel : undefined;
              const items = p.model === "compra_unica"
                ? [["Compras", commerce?.registeredPurchases], ["Acessos", commerce?.provisionedPurchases], ["Cliques", commerce?.events.checkoutClicks]]
                : [["Usuários", users.total], ["Ativos · 30d", users.active], ["Novos · mês", users.newMonth]];
              const commercial = data?.por_produto?.[p.id] ?? (p.id === "members" ? data?.por_produto?.membros : undefined);
              const status = { ok: "Conectado", stale: "Dados desatualizados", unavailable: "Consulta indisponível", not_configured: "Coleta pendente" }[p.result.status];
              return <Link key={p.id} href={`/empresa/negocios/${p.id}`} prefetch={false} className="card block min-w-0 p-4 transition hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-[#101318] p-1.5"><Image src={p.logo} alt="" width={24} height={24} sizes="24px" className="size-6 object-contain" /></span>
                    <div className="min-w-0 flex-1"><h4 className="truncate text-[14px] font-semibold">{p.name}</h4><p className="text-[10.5px] text-faint">{MODEL_INFO[p.model].label}</p></div>
                    <ArrowUpRight className="size-4 shrink-0 text-faint" aria-hidden />
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2">
                    {items.map(([label, value]) => (
                      <div key={String(label)} className="min-w-0"><dt className="truncate text-[10.5px] text-faint">{label}</dt><dd className="mt-0.5 text-[16px] font-semibold tabular-nums">{num(value as number | undefined)}</dd></div>
                    ))}
                  </dl>
                  <div className="mt-3 space-y-2 border-t border-border pt-3 text-[11px]">
                    <p className={p.result.status === "ok" ? "text-muted" : "text-faint"}>{status}{p.result.data ? ` · ${new Date(p.result.data.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}</p>
                    <p className="text-faint">CRM: {num(commercial?.oportunidades_abertas)} oportunidades · {num(commercial?.clientes)} clientes</p>
                    {engagement && <p className="text-faint">Engajados no mês: {num(engagement.currentMonth.engaged)} · aulas observadas desde {new Date(engagement.playbackObservedFrom).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>}
                    <p className="text-faint">{p.model === "compra_unica" ? commerce ? "Compras registradas; cliques não são usuários únicos." : "Ativar a coleta de compras e eventos." : users.total === null ? "Conectar dados de usuários do aplicativo." : users.active === null ? "Falta medir atividade de usuários." : users.newMonth === null ? "Falta medir cadastros no mês." : "Cadastros e atividade disponíveis."}</p>
                  </div>
                </>
              </Link>;
            })}
          </div>
        </div>
      )}
      <p className="text-[11px] leading-relaxed text-faint">Fonte: agregados dos aplicativos via CRM MCP e funil comercial do CRM. Contas e assinaturas não medem engajamento. — indica dado indisponível, não zero.</p>
    </section>
  );
}
