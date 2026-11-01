import { Activity, ArrowUpRight, BadgeDollarSign, Mail, Target, UserPlus, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BarCompare, ChartCard, DonutBreakdown, KpiCard } from "@/components/ui/revenue-charts-kpi";
import { CRM_FUNNEL } from "@/lib/crm-aggregates";
import { crmCommercialSummary, crmEmailFunnel } from "@/server/crm-commercial";
import { productMetrics } from "@/server/product-metrics";
import { BUSINESS_UNITS, MODEL_INFO } from "@/lib/business-models";
import { businessAudience, sumBusinessAudience } from "@/lib/business-audience";
import { crmKeyForUnit } from "@/lib/business-crm";

const NAMES: Record<string, string> = { barberias: "Barberias", mecard: "MeCard", members: "Members", membros: "Members", viajeki: "Viajeki", aglabs: "AG LABS", "ag-labs": "AG LABS", localsite: "Desenvolvimento web", "local-site": "Desenvolvimento web", desenvolvimento_web: "Desenvolvimento web", sem_produto: "A definir" };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = (v?: number | null) => (v == null ? "—" : v.toLocaleString("pt-BR"));
const pct = (part?: number | null, whole?: number | null) => (part == null || !whole ? null : Math.round((part / whole) * 100));
const STATUS = { ok: ["Conectado", "bg-success"], stale: ["Desatualizado", "bg-warning"], unavailable: ["Indisponível", "bg-danger"], not_configured: ["Coleta pendente", "bg-faint"] } as const;

/**
 * Visão única do negócio: cada número aparece uma vez.
 * Usuários vêm dos apps; funil, receita e e-mails vêm do CRM (todos os produtos).
 */
export async function ProductPortfolio() {
  const [result, emails, snapshots] = await Promise.all([
    crmCommercialSummary(),
    crmEmailFunnel({ dias: 30 }),
    Promise.all(BUSINESS_UNITS.map(async unit => ({ ...unit, result: await productMetrics(unit.id) }))),
  ]);
  const now = Date.parse(result.checkedAt);
  const userApps = snapshots.filter(unit => unit.model !== "compra_unica");
  const audience = sumBusinessAudience(userApps, now);
  const data = result.data;
  const named = Object.entries(data?.por_produto ?? {}).map(([key, p]) => ({ key, name: NAMES[key] ?? key, ...p }));
  const checked = new Date(result.checkedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const revenueDelta = data?.receita_mes != null && data.receita_mes_anterior ? data.receita_mes / data.receita_mes_anterior - 1 : undefined;
  const partial = (m: typeof audience.total) => (m.covered < m.products ? `${m.covered} de ${m.products} apps informam` : `${m.products} apps`);

  const usersByApp = userApps.map(unit => ({ app: unit.name, ...businessAudience(unit.result, now) }))
    .filter(row => row.total != null || row.active != null || row.newMonth != null)
    .map(row => ({ app: row.app, total: row.total, ativos: row.active, novos: row.newMonth }));
  const funnel = CRM_FUNNEL.map(stage => ({ label: stage, value: data?.funil?.[stage] ?? null }));
  const byProduct = named.filter(p => p.key !== "sem_produto" || (p.oportunidades_abertas ?? 0) + (p.clientes ?? 0) > 0)
    .map(p => ({ produto: p.name, oportunidades: p.oportunidades_abertas ?? null, clientes: p.clientes ?? null, novos: p.novos_30d ?? null }));
  const accounts = named.filter(p => p.contas).map(p => ({ produto: p.name, ativas: p.contas?.ativo ?? null, teste: p.contas?.trial ?? null, encerradas: p.contas?.trial_encerrado ?? null, canceladas: p.contas?.cancelado ?? null }));
  const base = named.filter(p => (p.base_prospeccao ?? 0) > 0).map((p, i) => ({ label: p.name, value: p.base_prospeccao ?? 0, slot: (((i % 5) + 1) as 1 | 2 | 3 | 4 | 5) }));
  const mail = emails.data?.total;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Ecossistema · apps + CRM</p>
          <h2 className="mt-1 text-[17px] font-semibold tracking-tight">Visão do negócio</h2>
        </div>
        <p className="text-[11.5px] text-faint">Consultado agora · {checked}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard icon={<Users />} label="Usuários nos apps" value={num(audience.total.value)} hint={partial(audience.total)} />
        <KpiCard icon={<Activity />} label="Ativos · 30 dias" value={num(audience.active.value)} hint={pct(audience.active.value, audience.total.value) != null ? `${pct(audience.active.value, audience.total.value)}% dos usuários · ${partial(audience.active)}` : partial(audience.active)} />
        <KpiCard icon={<UserPlus />} label="Novos no mês" value={num(audience.newMonth.value)} hint={partial(audience.newMonth)} />
        <KpiCard icon={<BadgeDollarSign />} label="Receita líquida · mês" value={data?.receita_mes == null ? "—" : brl(data.receita_mes)} delta={revenueDelta} period="vs mês anterior" hint={data?.receita_total != null ? `${brl(data.receita_total)} acumulado` : undefined} />
        <KpiCard icon={<Target />} label="Oportunidades abertas" value={num(data?.oportunidades_abertas)} hint={data?.contatos_a_qualificar != null ? `${num(data.contatos_a_qualificar)} a qualificar` : undefined} />
        <KpiCard icon={<Mail />} label="E-mails · 30 dias" value={num(mail?.enviados)} hint={mail?.taxa_resposta != null && mail.entregues ? `${mail.taxa_resposta.toLocaleString("pt-BR")}% de resposta · ${num(mail.respostas)} respostas` : emails.status !== "ok" ? "Funil de e-mails indisponível" : undefined} />
      </div>

      {result.status !== "ok" && <p role="status" className="card px-4 py-3 text-[12.5px] text-warning">CRM: {result.message}</p>}

      <div className="grid gap-3 lg:grid-cols-2">
        {usersByApp.length > 0 && (
          <ChartCard title="Usuários por aplicativo" subtitle="Cadastros, ativos em 30 dias e novos no mês">
            <BarCompare data={usersByApp} xKey="app" height={240} description="Usuários totais, ativos e novos por aplicativo"
              series={[{ key: "total", label: "Cadastrados", slot: 1 }, { key: "ativos", label: "Ativos · 30d", slot: 3 }, { key: "novos", label: "Novos · mês", slot: 2 }]} />
          </ChartCard>
        )}
        {data?.funil && (
          <ChartCard title="Funil comercial" subtitle="Contatos por etapa e conversão a partir de Lead · todos os produtos">
            <FunnelBars rows={funnel} />
            <p className="mt-3 text-[11px] text-faint">{num(data.clientes)} clientes na etapa Cliente{data.pagantes_mes != null ? ` · ${num(data.pagantes_mes)} pagantes no mês` : ""}{data.novos_30d != null ? ` · ${num(data.novos_30d)} contatos novos em 30 dias` : ""}.</p>
          </ChartCard>
        )}
        <ChartCard title="Funil de e-mails" subtitle={`Todos os apps · últimos 30 dias${emails.data?.campanhas != null ? ` · ${num(emails.data.campanhas)} campanhas` : ""}`}>
          {!mail ? <p className="text-[12.5px] text-muted">{emails.message ?? "O CRM não retornou o funil de e-mails."}</p> : <>
            <FunnelBars rows={[["Enviados", mail.enviados], ["Entregues", mail.entregues], ["Abertos", mail.abertos], ["Com clique", mail.cliques], ["Com resposta", mail.respostas]].map(([label, value]) => ({ label: label as string, value: (value as number | undefined) ?? null }))} />
            <p className="mt-3 text-[11px] text-faint">{num(mail.falhas)} falhas · {num(mail.descadastros)} descadastros · {num(emails.data?.respostas_recebidas)} respostas recebidas. Aberturas dependem de pixel e contam mensagens, não pessoas.</p>
          </>}
        </ChartCard>
        {byProduct.length > 0 && (
          <ChartCard title="Comercial por produto" subtitle="Oportunidades abertas, clientes e novos contatos em 30 dias">
            <BarCompare data={byProduct} xKey="produto" height={240} description="Oportunidades, clientes e novos contatos por produto"
              series={[{ key: "oportunidades", label: "Oportunidades", slot: 1 }, { key: "clientes", label: "Clientes", slot: 3 }, { key: "novos", label: "Novos · 30d", slot: 2 }]} />
          </ChartCard>
        )}
        {accounts.length > 0 && (
          <ChartCard title="Contas nos produtos" subtitle="Estado das contas no CRM · não comprova pagamento">
            <BarCompare data={accounts} xKey="produto" height={220} stacked description="Contas por estado em cada produto"
              series={[{ key: "ativas", label: "Ativas", slot: 3 }, { key: "teste", label: "Em teste", slot: 1 }, { key: "encerradas", label: "Teste encerrado", slot: 4 }, { key: "canceladas", label: "Canceladas", slot: 2 }]} />
          </ChartCard>
        )}
        {base.length > 0 && (
          <ChartCard title="Base de prospecção" subtitle="Contatos frios, fora das oportunidades">
            <DonutBreakdown data={base} centerLabel="Contatos" description="Base de prospecção por produto" />
          </ChartCard>
        )}
      </div>

      <div className="card overflow-x-auto p-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4"><h3 className="text-sm font-semibold">Aplicativos</h3><p className="text-[11px] text-faint">Clique para ver o detalhe de cada negócio</p></div>
        <table className="mt-2 w-full min-w-[720px] text-[12.5px]">
          <thead><tr className="border-b border-border text-left text-[10.5px] uppercase tracking-wider text-faint">
            <th className="px-4 py-2 font-medium">App</th><th className="px-3 py-2 text-right font-medium">Usuários</th><th className="px-3 py-2 text-right font-medium">Ativos · 30d</th><th className="px-3 py-2 text-right font-medium">Novos · mês</th><th className="px-3 py-2 text-right font-medium">Oportunidades</th><th className="px-3 py-2 text-right font-medium">Clientes</th><th className="px-4 py-2 font-medium">Coleta</th>
          </tr></thead>
          <tbody>{snapshots.map(p => {
            const users = businessAudience(p.result, now);
            const commerce = p.result.status === "ok" ? p.result.data?.commerceFunnel : undefined;
            const crm = data?.por_produto?.[crmKeyForUnit(p.id)] ?? (p.id === "members" ? data?.por_produto?.membros : undefined);
            const [label, dot] = STATUS[p.result.status];
            const updated = p.result.data ? new Date(p.result.data.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;
            const cells = p.model === "compra_unica"
              ? [<span key="c">{num(commerce?.registeredPurchases)}<span className="block text-[10px] text-faint">compras</span></span>, <span key="a">{num(commerce?.provisionedPurchases)}<span className="block text-[10px] text-faint">acessos</span></span>, <span key="k">{num(commerce?.events.checkoutClicks)}<span className="block text-[10px] text-faint">cliques</span></span>]
              : [users.total, users.active, users.newMonth].map((v, i) => <span key={i}>{num(v)}{i === 1 && pct(v, users.total) != null && <span className="block text-[10px] text-faint">{pct(v, users.total)}%</span>}</span>);
            return <tr key={p.id} className="group border-b border-border last:border-0 hover:bg-surface-2">
              <td className="px-4 py-2.5"><Link href={`/empresa/negocios/${p.id}`} prefetch={false} className="flex items-center gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-[#101318] p-1.5"><Image src={p.logo} alt="" width={22} height={22} sizes="22px" className="size-5 object-contain" /></span>
                <span className="min-w-0"><span className="flex items-center gap-1 font-medium group-hover:text-accent">{p.name}<ArrowUpRight className="size-3 text-faint" aria-hidden /></span><span className="block text-[10.5px] text-faint">{MODEL_INFO[p.model].label}</span></span>
              </Link></td>
              {cells.map((c, i) => <td key={i} className="px-3 py-2.5 text-right tabular-nums">{c}</td>)}
              <td className="px-3 py-2.5 text-right tabular-nums">{num(crm?.oportunidades_abertas)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{num(crm?.clientes)}</td>
              <td className="px-4 py-2.5"><span className="flex items-center gap-1.5 text-[11.5px]"><span aria-hidden className={`size-1.5 rounded-full ${dot}`} />{label}</span>{updated && <span className="block text-[10px] text-faint">{updated}</span>}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <p className="text-[11px] leading-relaxed text-faint">Usuários: soma dos apps, sem deduplicar a mesma pessoa entre produtos; apps sem coleta ficam fora da soma. VibeKit é medido por compras. Funil, receita e e-mails: CRM, todos os produtos. — indica dado indisponível, não zero.</p>
    </section>
  );
}

/** Barras de funil: largura relativa à primeira etapa, com valor e conversão. */
function FunnelBars({ rows }: { rows: { label: string; value: number | null }[] }) {
  const top = rows.find(r => r.value != null)?.value ?? 0;
  return (
    <ol className="space-y-2">
      {rows.map((row, i) => {
        const share = pct(row.value, top);
        const prev = i > 0 ? rows[i - 1].value : null;
        const step = i > 0 ? pct(row.value, prev) : null;
        return <li key={row.label} className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-3 text-[12px]">
          <span className="truncate text-muted">{row.label}</span>
          <span className="h-6 overflow-hidden rounded-md bg-surface-2">
            <span className="flex h-full items-center rounded-md px-2 text-[10.5px] font-medium text-white" style={{ width: `${Math.max(share ?? 0, row.value ? 4 : 0)}%`, background: `var(--chart-${(i % 5) + 1})` }}>{share != null && share >= 12 ? `${share}%` : ""}</span>
          </span>
          <span className="w-20 text-right tabular-nums"><span className="font-semibold">{num(row.value)}</span>{step != null && <span className="block text-[10px] text-faint">{step}% da anterior</span>}</span>
        </li>;
      })}
    </ol>
  );
}
