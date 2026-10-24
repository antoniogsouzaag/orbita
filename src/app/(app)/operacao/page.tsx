import { Activity, AlertTriangle, Bot, CheckCircle2, Gauge, Plug, Radio, XCircle } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { CopyButton } from "@/components/ops/copy-button";
import { StatusBoard, type BoardItem } from "@/components/ops/status-board";
import { PageHeader } from "@/components/ui/card";
import { BarRows, Big, ColumnBars, Dot, Legend, Ring, ShareStrip, WidgetShell, lastDays, type Tone } from "@/components/ui/mini-charts";
import { WidgetBoard } from "@/components/ui/widget-board";
import { cn } from "@/lib/utils";
import { monitorTargets } from "@/server/ops";
import { coherence, liveOps, opsEventsByDay } from "@/server/ops-live";
import { VaultBanner } from "@/components/vault/vault-banner";
import { getVaultIndexSafe } from "@/server/vault";

export const metadata = { title: "Operação" };

const norm = (u: string) => u.replace(/\/+$/, "").toLowerCase();

function ago(d: Date) {
  const m = Math.round((Date.now() - d.getTime()) / 60_000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `há ${h}h` : `há ${Math.round(h / 24)} dias`;
}

const EVENT_STYLE: Record<string, { icon: typeof XCircle; tone: string; label: string }> = {
  site_down: { icon: XCircle, tone: "text-danger", label: "Fora do ar" },
  site_up: { icon: CheckCircle2, tone: "text-success", label: "Voltou" },
  workflow_error: { icon: AlertTriangle, tone: "text-warning", label: "Falha no workflow" },
  agente_info: { icon: Bot, tone: "text-muted", label: "Agente" },
  agente_alerta: { icon: AlertTriangle, tone: "text-warning", label: "Alerta de agente" },
  agente_incidente: { icon: XCircle, tone: "text-danger", label: "Incidente (agente)" },
  agente_resumo: { icon: Bot, tone: "text-muted", label: "Resumo do agente" },
};

/** Categoria do evento para o gráfico empilhado. */
const EVENT_GROUP: { name: string; tone: Tone; match: (kind: string) => boolean }[] = [
  { name: "quedas", tone: "err", match: (k) => k === "site_down" || k === "agente_incidente" },
  { name: "falhas de workflow", tone: "warn", match: (k) => k === "workflow_error" || k === "agente_alerta" },
  { name: "retornos", tone: "ok", match: (k) => k === "site_up" },
  { name: "agentes", tone: "idle", match: (k) => k === "agente_info" || k === "agente_resumo" },
];

export default async function Page() {
  const [live, targets, coh, h, byDay] = await Promise.all([liveOps(), monitorTargets().catch(() => null), coherence().catch(() => null), headers(), opsEventsByDay(14).catch(() => [])]);
  const vaultByUrl = new Map((targets ?? []).map((t) => [norm(t.url), t]));
  const board: BoardItem[] = live.status.map((s) => {
    const v = vaultByUrl.get(norm(s.url));
    return { url: s.url, name: s.name, group: v?.group ?? s.group ?? "Fora da nota do vault", ok: s.ok, unstable: s.ok && s.fails > 0, status: s.statusCode, error: s.error, ms: s.latencyMs, checkedAt: s.checkedAt.toISOString(), since: s.changedAt.toISOString(), source: live.monitors.find((m) => m.source === s.source)?.label ?? s.source };
  });
  const groupOrder = [...new Set((targets ?? []).map((t) => t.group))];
  const openIncidents = live.events.filter((e) => e.kind === "site_down" && !e.resolvedAt);
  const wf24 = live.events.filter((e) => e.kind === "workflow_error" && live.generatedAt - e.createdAt.getTime() < 86_400_000);
  const soonDomains = live.domains.filter((d) => d.expiresAt && d.expiresAt.getTime() - live.generatedAt < 45 * 86_400_000);
  const silent = live.monitors.filter((m) => m.silent);
  const down = board.filter((b) => !b.ok);
  const unstable = board.filter((b) => b.ok && b.unstable);
  const up = board.filter((b) => b.ok && !b.unstable);
  const priorities = [
    ...(silent.length ? [{ title: `${silent.length} monitor(es) sem atualização`, detail: "Restabeleça a coleta antes de interpretar disponibilidade.", href: "/operacao/automacoes", tone: "err" as Tone }] : []),
    ...(down.length ? [{ title: `${down.length} endereço(s) com falha`, detail: "Priorize os produtos afetados.", href: "#disponibilidade", tone: "err" as Tone }] : []),
    ...(wf24.length ? [{ title: `${wf24.length} falha(s) de workflow em 24h`, detail: "Inspecione a execução antes de repetir efeitos.", href: "/operacao/automacoes", tone: "warn" as Tone }] : []),
    ...(soonDomains.length ? [{ title: `${soonDomains.length} domínio(s) perto do vencimento`, detail: "Confira responsabilidade na origem antes de renovar.", href: "#dominios", tone: "warn" as Tone }] : []),
    ...(coh?.notMonitored.length || coh?.notInVault.length ? [{ title: "Inventário e coleta diferentes", detail: "Revise vínculos entre vault e monitor.", href: "#coerencia", tone: "warn" as Tone }] : []),
  ];

  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "orbita";
  const base = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
  const monitorNote = (await getVaultIndexSafe())?.resolve("Monitoramento de Disponibilidade") ?? null;

  // Séries de 14 dias a partir dos eventos recebidos.
  const days = lastDays(14, live.generatedAt);
  const axis: [string, string] = [days[0].label, "hoje"];
  // Contagem agregada no banco: a lista abaixo traz só os eventos mais recentes.
  const count = (match: (kind: string) => boolean, key: string) => byDay.filter((r) => r.day === key && match(r.kind)).reduce((n, r) => n + r.count, 0);
  const perDay = (match: (kind: string) => boolean) => days.map((d) => count(match, d.key));
  const downDays = perDay((k) => k === "site_down");
  const wfDays = perDay((k) => k === "workflow_error");
  const stacked = days.map((d, i) => ({ label: d.label, segments: EVENT_GROUP.map((g) => ({ name: g.name, tone: g.tone, value: count(g.match, days[i].key) })) }));
  const events14 = byDay.reduce((n, r) => n + r.count, 0);

  // Disponibilidade por grupo.
  const groups = [...new Set(board.map((b) => b.group))]
    .map((g) => ({ g, list: board.filter((b) => b.group === g) }))
    .sort((a, b) => (groupOrder.indexOf(a.g) < 0 ? 99 : groupOrder.indexOf(a.g)) - (groupOrder.indexOf(b.g) < 0 ? 99 : groupOrder.indexOf(b.g)));

  const withMs = board.filter((b) => b.ms !== null).sort((a, b) => (b.ms ?? 0) - (a.ms ?? 0));
  const msValues = withMs.map((b) => b.ms ?? 0).sort((a, b) => a - b);
  const median = msValues.length ? msValues[Math.floor(msValues.length / 2)] : null;

  const vaultCovered = coh ? coh.vaultCount - coh.notMonitored.length : 0;

  const panels: Record<string, React.ReactNode> = {
    uptime: (
      <WidgetShell title="Disponibilidade" meta={board.length ? `${groups.length} grupos` : undefined} href="#disponibilidade" hrefLabel="Detalhes">
        <div className="flex min-h-0 flex-1 items-center gap-5">
          <Ring value={up.length + unstable.length} total={board.length} tone={down.length || unstable.length ? "warn" : "ok"} size={96} stroke={9} label={`${up.length + unstable.length} de ${board.length} endereços no ar`}>
            <span className="text-[19px] font-semibold tabular-nums leading-none">{board.length ? `${Math.round(((up.length + unstable.length) / board.length) * 100)}%` : "—"}</span>
            <span className="mt-1 text-[10px] text-faint">no ar</span>
          </Ring>
          <div className="min-w-0 flex-1 space-y-2.5">
            <Big unit="no ar" tone={down.length ? "err" : board.length ? undefined : "idle"}>{board.length ? `${up.length + unstable.length}/${board.length}` : "—"}</Big>
            <ShareStrip label={`${up.length} estáveis, ${unstable.length} instáveis, ${down.length} fora do ar`} parts={[{ name: "Estáveis", value: up.length, tone: "ok" }, { name: "Instáveis", value: unstable.length, tone: "warn" }, { name: "Fora do ar", value: down.length, tone: "err" }]} />
            <Legend items={[{ name: "estáveis", tone: "ok", value: up.length }, { name: "instáveis", tone: "warn", value: unstable.length }, { name: "fora", tone: "err", value: down.length }]} />
            <ul className="hidden gap-x-4 gap-y-1 text-[11.5px] text-muted @[420px]:grid @[420px]:grid-cols-2">
              {groups.slice(0, 4).map(({ g, list }) => (
                <li key={g} className="flex min-w-0 items-center gap-1.5"><Dot tone={list.every((i) => i.ok) ? "ok" : "err"} /><span className="truncate">{g}</span><span className="ml-auto tabular-nums text-fg">{list.filter((i) => i.ok).length}/{list.length}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </WidgetShell>
    ),
    attention: (
      <WidgetShell title="O que pede atenção" meta={priorities.length ? `${priorities.length} itens` : "tudo em ordem"} href="/documentacao#continuidade" hrefLabel="Guia">
        {priorities.length ? (
          <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
            {priorities.map((p) => (
              <li key={p.title}>
                <Link href={p.href} className="-mx-2 flex items-start gap-2.5 rounded-xl px-2 py-1 transition hover:bg-surface-2">
                  <span className="mt-1.5"><Dot tone={p.tone} /></span>
                  <span className="min-w-0"><span className="block truncate text-[13px] font-medium">{p.title}</span><span className="block truncate text-[11.5px] text-faint">{p.detail}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-1 items-center gap-3 text-[13px] text-muted"><CheckCircle2 className="size-5 shrink-0 text-success" />{live.monitors.length ? "Nenhum alerta nas verificações recebidas." : "Aguardando dados dos monitores. Confira a conexão em Integrações."}</div>
        )}
      </WidgetShell>
    ),
    incidents: (
      <WidgetShell title="Incidentes abertos" meta="14 dias">
        <Big tone={openIncidents.length ? "err" : undefined} unit={openIncidents.length === 1 ? "aberto" : "abertos"}>{openIncidents.length}</Big>
        <ColumnBars className="mt-auto" axis={axis} label={`Quedas registradas por dia nos últimos 14 dias: ${downDays.reduce((a, b) => a + b, 0)} no total.`} columns={days.map((d, i) => ({ label: d.label, segments: [{ name: "quedas", tone: "err", value: downDays[i] }] }))} />
      </WidgetShell>
    ),
    workflows: (
      <WidgetShell title="Falhas de workflow" meta="24h" href="/operacao/automacoes" hrefLabel="n8n">
        <Big tone={wf24.length ? "warn" : undefined} unit={`${wfDays.reduce((a, b) => a + b, 0)} em 14d`}>{wf24.length}</Big>
        <ColumnBars className="mt-auto" axis={axis} label={`Falhas de workflow por dia nos últimos 14 dias: ${wfDays.reduce((a, b) => a + b, 0)} no total.`} columns={days.map((d, i) => ({ label: d.label, segments: [{ name: "falhas", tone: "warn", value: wfDays[i] }] }))} />
      </WidgetShell>
    ),
    monitors: (
      <WidgetShell title="Monitores" meta={silent.length ? `${silent.length} em silêncio` : "batendo"}>
        <Big tone={silent.length ? "err" : undefined} unit="ativos">{live.monitors.length ? `${live.monitors.length - silent.length}/${live.monitors.length}` : "—"}</Big>
        <ul className="mt-auto min-h-0 space-y-1.5 overflow-y-auto text-[12px]">
          {live.monitors.length === 0 && <li className="text-faint">Nenhum monitor ligado ainda.</li>}
          {live.monitors.map((m) => (
            <li key={m.source} className="flex items-center gap-2"><Dot tone={m.silent ? "err" : "ok"} pulse={!m.silent} /><span className="min-w-0 flex-1 truncate">{m.label}</span><span className={cn("shrink-0 tabular-nums", m.silent ? "text-danger" : "text-faint")}>{ago(m.lastSeen)}</span></li>
          ))}
        </ul>
      </WidgetShell>
    ),
    coherence: (
      <WidgetShell title="Cobertura do vault" href={monitorNote ? `/vault?p=${encodeURIComponent(monitorNote)}` : undefined} hrefLabel="Nota">
        {!coh ? <p className="text-[12.5px] text-muted">Conecte o vault para comparar.</p> : (
          <div id="coerencia" className="flex flex-1 items-center gap-4">
            <Ring value={vaultCovered} total={coh.vaultCount} tone={coh.notMonitored.length ? "warn" : "ok"} label={`${vaultCovered} de ${coh.vaultCount} endereços do vault estão sendo verificados`}>
              <span className="text-[15px] font-semibold tabular-nums">{coh.vaultCount ? `${Math.round((vaultCovered / coh.vaultCount) * 100)}%` : "—"}</span>
            </Ring>
            <dl className="min-w-0 space-y-1.5 text-[12px]">
              <div><dt className="text-faint">Sem verificação</dt><dd className={cn("font-medium tabular-nums", coh.notMonitored.length ? "text-warning" : "text-fg")}>{coh.notMonitored.length}</dd></div>
              <div><dt className="text-faint">Fora do vault</dt><dd className={cn("font-medium tabular-nums", coh.notInVault.length ? "text-warning" : "text-fg")}>{coh.notInVault.length}</dd></div>
            </dl>
          </div>
        )}
      </WidgetShell>
    ),
    events: (
      <WidgetShell title="Incidentes e eventos" meta={`${events14} em 14 dias`} href="/operacao/automacoes" hrefLabel="Automações">
        <ColumnBars height={72} axis={axis} label={`Eventos por dia nos últimos 14 dias, por tipo: ${EVENT_GROUP.map((g) => `${stacked.reduce((n, c) => n + (c.segments.find((s) => s.name === g.name)?.value ?? 0), 0)} ${g.name}`).join(", ")}.`} columns={stacked} />
        <Legend className="mt-2.5" items={EVENT_GROUP.map((g) => ({ name: g.name, tone: g.tone }))} />
        <ul className="-mx-2 mt-3 min-h-0 flex-1 space-y-0.5 overflow-y-auto border-t border-border pt-2">
          {live.events.length === 0 && <li className="px-2 text-[13px] text-muted">Nenhum evento registrado.</li>}
          {live.events.map((e) => {
            const st = EVENT_STYLE[e.kind] ?? { icon: Activity, tone: "text-muted", label: e.kind };
            const d = e.detail as { url?: string; message?: string; node?: string; executionUrl?: string; error?: string; status?: number };
            return (
              <li key={e.id} className="flex gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                <st.icon className={cn("mt-0.5 size-3.5 shrink-0", st.tone)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 text-[12.5px]"><span className="truncate font-medium">{e.subject}</span>{e.kind === "site_down" && e.resolvedAt && <span className="shrink-0 text-[11px] text-faint">resolvido</span>}{e.source.startsWith("agente:") && <Link href={`/agentes/${e.source.slice(7)}`} className="shrink-0 text-[11px] text-accent hover:underline">{String((e.detail as { agent?: string }).agent ?? e.source.slice(7))} ↗</Link>}</div>
                  <div className="truncate text-[11.5px] text-faint">{st.label}{(d.message ?? d.error ?? (d.status ? `HTTP ${d.status}` : null)) ? ` · ${d.message ?? d.error ?? `HTTP ${d.status}`}` : ""}{d.node ? ` · nó ${d.node}` : ""}</div>
                </div>
                <div className="shrink-0 text-right text-[11px] tabular-nums text-faint">
                  {e.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  {d.executionUrl && <a href={d.executionUrl} target="_blank" rel="noreferrer" className="block text-accent hover:underline">execução ↗</a>}
                </div>
              </li>
            );
          })}
        </ul>
      </WidgetShell>
    ),
    latency: (
      <WidgetShell title="Tempo de resposta" meta={median !== null ? `mediana ${median}ms` : undefined}>
        {withMs.length === 0 ? <p className="text-[12.5px] text-muted">Os monitores ainda não enviaram tempos de resposta.</p> : (
          <BarRows className="min-h-0 flex-1 overflow-y-auto pr-1" label="Endereços mais lentos na última verificação"
            rows={withMs.slice(0, 8).map((b) => ({ key: b.url, label: b.name, value: b.ms ?? 0, display: `${b.ms}ms`, tone: !b.ok ? "err" : b.unstable || (b.ms ?? 0) > 2000 ? "warn" : "accent", hint: b.url }))} />
        )}
      </WidgetShell>
    ),
    domains: (
      <WidgetShell title="Domínios" meta="dias até vencer">
        <div id="dominios" className="min-h-0 flex-1 overflow-y-auto pr-1">
          {live.domains.length === 0 ? <p className="text-[12.5px] text-muted">Nenhum domínio recebido. O monitor de vencimento envia a lista quando ligado à Órbita.</p> : (
            <BarRows label="Dias até o vencimento de cada domínio" max={365}
              rows={live.domains.map((d) => {
                const daysLeft = d.expiresAt ? Math.ceil((d.expiresAt.getTime() - live.generatedAt) / 86_400_000) : null;
                return { key: d.domain, label: d.domain, value: daysLeft === null ? 0 : Math.max(0, Math.min(365, daysLeft)), display: daysLeft === null ? "?" : daysLeft < 0 ? "vencido" : `${daysLeft}d`, tone: daysLeft === null ? "idle" : daysLeft < 8 ? "err" : daysLeft < 45 ? "warn" : "ok", hint: d.error ?? d.depends ?? (d.expiresAt ? d.expiresAt.toLocaleDateString("pt-BR") : undefined) };
              })} />
          )}
        </div>
      </WidgetShell>
    ),
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 sm:px-6">
      <PageHeader icon={<Gauge />} title="Operação" description="Disponibilidade, incidentes e prioridades da AG LABS." />
      <VaultBanner />

      {silent.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-danger/40 bg-danger/8 p-4 text-[13px]">
          <Radio className="mt-0.5 size-4 shrink-0 text-danger" />
          <div><b>Monitor em silêncio:</b> {silent.map((m) => `${m.label} (última batida ${ago(m.lastSeen)})`).join(", ")}. Silêncio não é o mesmo que “tudo certo” — confira o n8n.</div>
        </div>
      )}

      <WidgetBoard
        storageKey="operacao"
        title={<p className="text-[12px] text-faint">Estado recebido dos monitores · {new Date(live.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>}
        items={[
          { id: "uptime", size: "wide", label: "Disponibilidade" },
          { id: "attention", size: "wide", label: "O que pede atenção" },
          { id: "incidents", size: "sm", label: "Incidentes abertos" },
          { id: "workflows", size: "sm", label: "Falhas de workflow" },
          { id: "events", size: "lg", label: "Incidentes e eventos" },
          { id: "monitors", size: "sm", label: "Monitores" },
          { id: "coherence", size: "sm", label: "Cobertura do vault" },
          { id: "latency", size: "wide", label: "Tempo de resposta" },
          { id: "domains", size: "wide", label: "Domínios" },
        ]}
        panels={panels}
      />

      <div id="disponibilidade" className="scroll-mt-24"><StatusBoard initial={board} groupOrder={groupOrder} /></div>

      <details className="card group">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-[14px] font-semibold [&::-webkit-details-marker]:hidden">
          <Plug className="size-4 text-muted" />Integração com o n8n
          <span className="ml-auto text-[12px] font-normal text-faint group-open:hidden">mostrar endpoints</span>
        </summary>
        <div className="space-y-3 border-t border-border px-5 py-4 text-[13px] text-muted">
          <p>O n8n continua coletando; a Órbita guarda o histórico e mostra o estado. A lista de endereços sai da nota do vault. <Link href="/integracoes" className="text-accent hover:underline">Detalhes ↗</Link></p>
          {coh && (coh.notMonitored.length > 0 || coh.notInVault.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {coh.notMonitored.length > 0 && <div><div className="mb-1 text-[12px] font-medium text-warning">No vault, sem verificação ({coh.notMonitored.length})</div>{coh.notMonitored.map((t) => <div key={t.url} className="truncate text-[12px]">{t.priority} · {t.url}</div>)}</div>}
              {coh.notInVault.length > 0 && <div><div className="mb-1 text-[12px] font-medium text-warning">Verificado, fora do vault ({coh.notInVault.length})</div>{coh.notInVault.map((t) => <div key={t.url} className="truncate text-[12px]">{t.name} · {t.url}</div>)}</div>}
            </div>
          )}
          <Endpoint method="GET" url={`${base}/api/ops/alvos`} note="lista do vault para o n8n verificar" />
          <Endpoint method="POST" url={`${base}/api/ops/ingest`} note="n8n envia links, domínios e falhas" />
          <p className="text-[12px] text-faint">Os dois usam <code>Authorization: Bearer OPS_TOKEN</code>.</p>
        </div>
      </details>
    </div>
  );
}

function Endpoint({ method, url, note }: { method: string; url: string; note: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 font-mono text-[12px]">
      <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10.5px] font-bold text-fg">{method}</span>
      <span className="min-w-0 flex-1 break-all text-fg">{url}</span>
      <span className="font-sans text-[11.5px] text-faint">{note}</span>
      <CopyButton text={url} label="" className="px-1.5" />
    </div>
  );
}
