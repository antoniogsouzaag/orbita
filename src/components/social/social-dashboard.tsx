"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Building2, ExternalLink, RefreshCw } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { refreshSocialAction } from "@/app/actions/integrations";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SOCIAL_PENDING_ENTITIES, groupSocialChannels, preferredSocialChannel } from "@/lib/business";
import { compact, groupMetrics, headline, type MetricSummary } from "@/lib/social-metrics";
import type { SocialOverview } from "@/server/social";

const NETWORKS: Record<string, string> = { "instagram-standalone": "Instagram", instagram: "Instagram", facebook: "Facebook", threads: "Threads", youtube: "YouTube", linkedin: "LinkedIn", "linkedin-page": "LinkedIn", tiktok: "TikTok", x: "X" };
const network = (id: string) => NETWORKS[id] ?? id;
const handle = (c: { profile?: string | null; name: string }) => (c.profile ? `@${c.profile.replace(/^@/, "")}` : c.name);

export function SocialDashboard({ initial, panelUrl }: { initial: SocialOverview; panelUrl: string | null }) {
  const [data, setData] = React.useState(initial);
  const [pending, start] = React.useTransition();
  const channel = data.channels[0];
  const groups = groupSocialChannels(data.available ?? []);
  const entity = groups.find(g => g.id === data.entityId);
  const reports = [...(data.productChannels ?? [])].sort((a, b) => Number(/^instagram/.test(b.identifier)) - Number(/^instagram/.test(a.identifier)));
  const active = reports.filter(r => !r.disabled);
  const measured = active.filter(r => !r.error && r.metrics.some(m => m.data.length));

  const load = (id = channel?.id, days = data.days, group = data.entityId) => start(async () => {
    try {
      const next = await refreshSocialAction(id, days, group);
      setData(next);
      const params = new URLSearchParams({ aba: "metricas" });
      if (next.entityId) params.set("entidade", groups.find(g => g.id === next.entityId)?.key ?? next.entityId);
      if (next.channels[0]) params.set("canal", next.channels[0].id);
      if (days === 30) params.set("dias", "30");
      window.history.replaceState(null, "", `/redes?${params}`);
    } catch { toast.error("Não foi possível atualizar. Tente novamente."); }
  });

  if (!data.configured) return <Card className="p-5 text-sm text-muted">Conecte o Postiz em <Link href="/integracoes" className="text-accent underline">Integrações</Link> para carregar marcas e canais.</Card>;

  return <div aria-busy={pending} className="space-y-4">
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-border p-1" aria-label="Período">{([7, 30] as const).map(days => <button type="button" key={days} disabled={pending} onClick={() => load(channel?.id, days)} aria-pressed={data.days === days} className={`rounded-lg px-3 py-1.5 text-xs ${data.days === days ? "bg-accent/15 text-accent" : "text-muted"}`}>Últimos {days} dias</button>)}</div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-faint">Atualizado {new Date(data.checkedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</span>
          <Button size="sm" disabled={pending} onClick={() => load()}><RefreshCw className={pending ? "animate-spin" : ""} />{pending ? "Consultando…" : "Atualizar"}</Button>
          {panelUrl && <Button asChild size="sm" variant="ghost"><a href={panelUrl} target="_blank" rel="noopener noreferrer">Postiz<ExternalLink /></a></Button>}
        </div>
      </div>
      {!!groups.length && <nav aria-label="Marcas" className="flex gap-2 overflow-x-auto pb-1">{groups.map(g => <button type="button" key={g.id} disabled={pending} aria-pressed={entity?.id === g.id} onClick={() => load(preferredSocialChannel(g.channels)?.id, data.days, g.id)} className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition hover:bg-surface-2 disabled:opacity-60 ${entity?.id === g.id ? "border-accent/40 bg-accent/10" : "border-border"}`}>
        <span className="grid size-7 place-items-center rounded-lg border border-white/10 bg-[#101318] p-1">{g.logo ? <Image src={g.logo} alt="" width={24} height={24} className="size-5 object-contain" /> : <Building2 className="size-4 text-muted" />}</span>
        <span><span className="block text-sm font-medium">{g.name}</span><span className="block text-[10px] text-muted">{g.channels.length} {g.channels.length === 1 ? "canal" : "canais"}</span></span>
      </button>)}
        {SOCIAL_PENDING_ENTITIES.filter(p => !groups.some(g => g.key === p.id)).map(p => <div key={p.id} title="Marca sem grupo no Postiz" className="flex shrink-0 items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 opacity-70">
          <span className="grid size-7 place-items-center rounded-lg border border-white/10 bg-[#101318] p-1"><Image src={p.logo} alt="" width={24} height={24} className="size-5 object-contain grayscale" /></span>
          <span><span className="block text-sm font-medium text-muted">{p.name}</span><span className="block text-[10px] text-faint">Conectar no Postiz</span></span>
        </div>)}
      </nav>}
    </Card>

    {data.error && <p role="alert" className="rounded-xl border border-warning/30 p-4 text-sm text-warning">{data.error}</p>}
    {!data.error && !data.available?.length && <Card className="p-5 text-sm text-muted">Nenhum canal retornado pelo Postiz.</Card>}

    {entity && <Card className="overflow-x-auto p-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4"><h3 className="flex items-center gap-2 text-sm font-semibold">{entity.logo && <Image src={entity.logo} alt="" width={18} height={18} className="size-[18px] object-contain" />}Comparativo · {entity.name}</h3><p className="text-[11px] text-muted">{measured.length} de {active.length} canais ativos com métricas{entity.businessHref && <> · <Link href={entity.businessHref} className="text-accent hover:underline">ver negócio</Link></>}</p></div>
      <table className="mt-3 w-full min-w-[640px] text-sm">
        <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted"><th className="px-5 py-2 font-medium">Canal</th><th className="px-3 py-2 text-right font-medium">Audiência</th><th className="px-3 py-2 text-right font-medium">Alcance / views</th><th className="px-3 py-2 text-right font-medium">Interações</th><th className="px-5 py-2 text-right font-medium">Status</th></tr></thead>
        <tbody>{reports.map(r => {
          const cells = (["audiencia", "alcance", "interacao"] as const).map(g => headline(r.metrics, r.identifier, g));
          const status = r.disabled ? "Desativado" : r.error ? "Erro na consulta" : r.metrics.some(m => m.data.length) ? "OK" : "Sem dados";
          return <tr key={r.id} onClick={() => !pending && load(r.id)} aria-selected={channel?.id === r.id} className={`cursor-pointer border-b border-border last:border-0 hover:bg-surface-2 ${channel?.id === r.id ? "bg-accent/5" : ""}`}>
            <td className="px-5 py-3"><span className="font-medium">{network(r.identifier)}</span><span className="block text-[11px] text-muted">{handle(r)}</span></td>
            {cells.map((c, i) => <td key={i} className="px-3 py-3 text-right tabular-nums">{c ? <><span className="font-medium">{compact(c.value)}</span><span className="block text-[10px] text-faint">{c.label}</span></> : <span className="text-faint">—</span>}</td>)}
            <td className="px-5 py-3 text-right"><span className={`rounded-md px-2 py-0.5 text-[10px] ${status === "OK" ? "bg-success/15 text-success" : status === "Sem dados" ? "bg-surface-2 text-muted" : "bg-warning/15 text-warning"}`}>{status}</span></td>
          </tr>;
        })}</tbody>
      </table>
      <p className="px-5 py-3 text-[10px] text-faint">Valores por perfil na janela de {data.days} dias. Não some redes: alcance de perfis diferentes não representa pessoas únicas.</p>
    </Card>}

    {entity && channel && <section className="space-y-4">
      <div className="flex items-center gap-3">{entity.logo && <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-[#101318] p-1.5"><Image src={entity.logo} alt="" width={28} height={28} className="size-7 object-contain" /></span>}<div><p className="text-[10px] uppercase tracking-widest text-accent">{entity.name}</p><h2 className="mt-1 text-xl font-semibold">{network(channel.identifier)} <span className="text-sm font-normal text-muted">{handle(channel)}</span></h2></div></div>
      {channel.error ? <Card className="p-5"><p role="alert" className="text-sm text-warning">{channel.error}</p><p className="mt-2 text-xs text-muted">Isso não significa atividade zero; a consulta deste perfil falhou.</p><Button className="mt-4" size="sm" disabled={pending} onClick={() => load()}>Tentar novamente</Button></Card>
        : channel.disabled ? <Card className="p-5 text-sm text-muted">Canal desativado no Postiz. Reconecte-o no painel de origem.</Card>
        : !channel.metrics.length ? <Card className="p-5 text-sm text-muted">A rede não retornou dados para este período.</Card>
        : groupMetrics(channel.metrics, channel.identifier).map(g => <div key={g.group}><h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{g.label}</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{g.items.map((m, i) => <MetricCard key={`${m.key}-${i}`} m={m} />)}</div></div>)}
      <p className="text-[11px] leading-relaxed text-faint">Fonte: Postiz / {network(channel.identifier)}. Seguidores mostram o último valor; os demais somam a janela. Cache de até 1 hora — use Atualizar para buscar agora.</p>
    </section>}
  </div>;
}

function MetricCard({ m }: { m: MetricSummary }) {
  const min = Math.min(...m.values), max = Math.max(...m.values);
  const pts = m.values.map((v, i) => `${m.values.length > 1 ? (i / (m.values.length - 1)) * 280 : 140},${54 - ((v - min) / (max - min || 1)) * 44}`);
  const up = (m.change ?? 0) >= 0;
  return <Card className="min-w-0 p-4">
    <div className="flex items-start justify-between gap-2"><h4 className="text-xs font-medium text-muted">{m.label}</h4>{m.change !== null && <span className={`inline-flex items-center text-[11px] font-medium ${up ? "text-success" : "text-warning"}`}>{up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{Math.abs(m.change).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>}</div>
    <p className="mt-2 text-2xl font-semibold tabular-nums">{m.value === null ? "—" : m.value.toLocaleString("pt-BR")}</p>
    <p className="text-[10px] text-faint">{m.kind === "ultimo" ? `Último valor${m.lastDate ? ` · ${m.lastDate}` : ""}` : `Total da janela · ${m.points.length} dias`}</p>
    {m.values.length > 1 && <svg role="img" aria-label={`Evolução de ${m.label}`} viewBox="0 0 280 60" preserveAspectRatio="none" className="mt-3 h-14 w-full text-accent"><polygon points={`0,60 ${pts.join(" ")} 280,60`} fill="currentColor" opacity=".12" /><polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>}
    <details className="mt-2 text-xs"><summary className="cursor-pointer text-faint">Ver pontos</summary><div className="mt-2 max-h-40 overflow-auto"><table className="w-full"><tbody>{m.points.map((p, i) => <tr key={i}><td className="py-0.5 text-muted">{p.date}</td><td className="text-right tabular-nums">{p.total}</td></tr>)}</tbody></table></div></details>
  </Card>;
}
