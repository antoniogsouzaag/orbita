"use client";
import Image from "next/image";
import Link from "next/link";
import { Building2, ExternalLink, RefreshCw } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { refreshSocialAction } from "@/app/actions/integrations";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { groupSocialChannels } from "@/lib/business";
import type { SocialMetric, SocialOverview } from "@/server/social";

const NETWORKS: Record<string, string> = { "instagram-standalone": "Instagram", instagram: "Instagram", facebook: "Facebook", threads: "Threads", youtube: "YouTube", linkedin: "LinkedIn", "linkedin-page": "LinkedIn", tiktok: "TikTok" };
const LABELS: Record<string, string> = { Followers: "Seguidores", "Follower Count": "Seguidores", "Page followers": "Seguidores da página", Impressions: "Impressões", Reach: "Alcance", Likes: "Curtidas", Views: "Visualizações", Comments: "Comentários", Shares: "Compartilhamentos", Saves: "Salvamentos", Replies: "Respostas", Subscribers: "Inscritos" };
export function SocialDashboard({ initial, panelUrl }: { initial: SocialOverview; panelUrl: string | null }) {
  const [data, setData] = React.useState(initial);
  const [pending, start] = React.useTransition();
  const channel = data.channels[0];
  const groups = groupSocialChannels(data.available ?? []);
  const entity = groups.find((group) => group.id === data.entityId);
  const channels = entity?.channels ?? [];
  const network = channel ? NETWORKS[channel.identifier] ?? channel.identifier : "";
  const load = (id = channel?.id, days = data.days, group = data.entityId) => start(async () => {
    try {
      const next = await refreshSocialAction(id, days, group);
      setData(next);
      const params = new URLSearchParams();
      if (next.entityId) params.set("entidade", groups.find((item) => item.id === next.entityId)?.key ?? next.entityId);
      if (next.channels[0]) params.set("canal", next.channels[0].id);
      if (days === 30) params.set("dias", "30");
      window.history.replaceState(null, "", `/redes?${params}`);
    } catch { toast.error("Não foi possível atualizar. Tente novamente."); }
  });
  return <div className="space-y-5">
    <Card className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-br from-accent/10 via-surface to-surface p-5">
      <div><p className="text-[10px] uppercase tracking-[.2em] text-accent">Distribuição do ecossistema</p><h2 className="mt-2 text-lg font-semibold">Uma entidade. Todos os seus canais.</h2><p className="mt-1 text-xs text-muted">Os grupos do Postiz conectam cada perfil ao negócio certo.</p></div>
      <div className="flex flex-wrap gap-2"><Button size="sm" disabled={pending || !data.configured} onClick={() => load()}><RefreshCw className={pending ? "animate-spin" : ""} />{pending ? "Consultando…" : "Atualizar agora"}</Button>{panelUrl && <Button asChild size="sm" variant="ghost"><a href={panelUrl} target="_blank" rel="noopener noreferrer">Abrir Postiz<ExternalLink /></a></Button>}</div>
    </Card>
    {!data.configured && <Card className="p-5 text-sm text-muted">Conecte o Postiz em <Link href="/integracoes" className="text-accent underline">Integrações</Link> para carregar suas entidades e canais.</Card>}
    {data.error && <p role="alert" className="rounded-xl border border-warning/30 p-4 text-sm text-warning">{data.error}</p>}
    {!!groups.length && <>
      <nav aria-label="Entidades sociais" className="grid grid-cols-2 gap-3 lg:grid-cols-4">{groups.map((group) => <button type="button" key={group.id} disabled={pending} aria-pressed={entity?.id === group.id} onClick={() => load(group.channels.find((item) => !item.disabled)?.id ?? group.channels[0].id, data.days, group.id)} className={`flex min-w-0 items-center gap-3 rounded-2xl border p-4 text-left transition hover:bg-surface-2 disabled:opacity-60 ${entity?.id === group.id ? "border-accent/40 bg-accent/10" : "border-border bg-surface"}`}>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2">{group.logo ? <Image src={group.logo} alt="" width={36} height={36} className="size-9 object-contain" /> : <Building2 className="size-5 text-muted" />}</span>
        <span className="min-w-0"><span className="block truncate text-sm font-semibold">{group.name}</span><span className="mt-1 block text-[11px] text-muted">{group.channels.length} {group.channels.length === 1 ? "canal" : "canais"}</span></span>
      </button>)}</nav>
      {entity && <div className="grid items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">{entity.name}</h2>{entity.businessHref && <Link href={entity.businessHref} className="text-[11px] text-accent hover:underline">Ver negócio ↗</Link>}</div>
          <nav aria-label={`Canais de ${entity.name}`} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">{channels.map((item) => <button type="button" key={item.id} disabled={pending} aria-pressed={channel?.id === item.id} onClick={() => load(item.id)} className={`rounded-xl border p-3 text-left transition hover:bg-surface-2 disabled:opacity-60 ${channel?.id === item.id ? "border-accent/40 bg-accent/10" : "border-border bg-surface"}`}>
            <span className="block text-sm font-medium">{NETWORKS[item.identifier] ?? item.identifier}</span>
            <span className="mt-1 block truncate text-xs text-muted">{item.profile ? `@${item.profile.replace(/^@/, "")}` : item.name}{item.disabled ? " · desativado" : ""}</span>
            {item.profile && <span className="mt-1 block truncate text-[10px] text-faint">Nome na origem: {item.name}</span>}
          </button>)}</nav>
          <p className="text-[10px] leading-relaxed text-faint">Cada entidade reúne os perfis do seu grupo no Postiz. Os canais preservam o nome cadastrado na rede; contas sem grupo ficam em Sem entidade.</p>
        </aside>
        <section aria-busy={pending} className="min-w-0 space-y-4">{channel && <>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-widest text-accent">{entity.name}</p><h2 className="mt-1 text-xl font-semibold">{network}</h2><p className="mt-1 text-xs text-muted">{channel.profile ? `@${channel.profile.replace(/^@/, "")} · ` : ""}{channel.name}</p></div><div className="flex gap-1 rounded-xl border border-border p-1" aria-label="Período">{([7, 30] as const).map((days) => <button type="button" key={days} disabled={pending} onClick={() => load(channel.id, days)} aria-pressed={data.days === days} className={`rounded-lg px-3 py-1.5 text-xs ${data.days === days ? "bg-accent/15 text-accent" : "text-muted"}`}>{days} dias</button>)}</div></div>
          {channel.error ? <Card className="p-5"><p role="alert" className="text-sm text-warning">{channel.error}</p><p className="mt-2 text-xs text-muted">Os canais responderam; as métricas deste perfil estão indisponíveis. Isso não representa atividade zero.</p><Button className="mt-4" size="sm" disabled={pending} onClick={() => load()}>Tentar novamente</Button></Card> : channel.disabled ? <Card className="p-5 text-sm text-muted">Canal desativado no Postiz. Reconecte-o no painel de origem.</Card> : !channel.metrics.length ? <Card className="p-5 text-sm text-muted">A rede não retornou séries para este período. Algumas redes ou contas não oferecem analytics por canal.</Card> : <div className="grid gap-3 sm:grid-cols-2">{channel.metrics.map((metric, i) => <MetricCard key={`${metric.label}-${i}`} metric={metric} />)}</div>}
          <p className="text-[11px] leading-relaxed text-faint">Fonte: Postiz / {network} · janela solicitada: {data.days} dias · consultado em {new Date(data.checkedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Métricas automáticas: cache de até 1 hora. Atualizar agora renova nomes, grupos e métricas. Seguidores, alcance e visualizações são apresentados por perfil.</p>
        </>}</section>
      </div>}
    </>}
    {data.configured && !data.error && !data.available?.length && <Card className="p-5 text-sm text-muted">Nenhum canal retornado pelo Postiz.</Card>}
  </div>;
}
function MetricCard({ metric }: { metric: SocialMetric }) {
  const points = [...metric.data].sort((a, b) => a.date.localeCompare(b.date));
  const last = points.at(-1);
  const numeric = points.filter((p) => p.total.trim() !== "" && Number.isFinite(Number(p.total)));
  const values = numeric.map((p) => Number(p.total));
  const min = Math.min(...values), max = Math.max(...values);
  const line = values.map((value, i) => `${values.length > 1 ? i / (values.length - 1) * 280 : 140},${50 - (value - min) / (max - min || 1) * 40}`).join(" ");
  return <Card className="min-w-0 p-5"><h3 className="text-xs font-medium text-muted">{LABELS[metric.label] ?? metric.label}</h3><p className="mt-3 text-3xl font-semibold tabular-nums">{last ? (last.total.trim() && Number.isFinite(Number(last.total)) ? Number(last.total).toLocaleString("pt-BR") : last.total || "—") : "—"}</p><p className="mt-1 text-[11px] text-faint">Último ponto{last ? ` · ${last.date}` : " indisponível"}</p>{values.length > 1 && <svg role="img" aria-label={`Evolução de ${metric.label} em ${values.length} pontos`} viewBox="0 0 280 60" className="mt-4 h-16 w-full text-accent"><polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>}{metric.percentageChange != null && <p className="mt-2 text-xs text-muted">{metric.percentageChange > 0 ? "+" : ""}{metric.percentageChange}% · variação informada pelo Postiz</p>}<details className="mt-4 text-xs"><summary className="cursor-pointer text-muted">Ver os {points.length} pontos da série</summary><div className="mt-3 max-h-44 overflow-auto"><table className="w-full"><thead><tr className="text-faint"><th className="text-left">Data</th><th className="text-right">Valor</th></tr></thead><tbody>{points.map((point, i) => <tr key={i}><td className="py-1">{point.date}</td><td className="text-right tabular-nums">{point.total}</td></tr>)}</tbody></table></div></details></Card>;
}
