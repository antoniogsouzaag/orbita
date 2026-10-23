import { Activity, AlertTriangle, ArrowUpRight, Bot, CheckCircle2, Gauge, Globe, HeartPulse, Plug, Radio, XCircle } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { CopyButton } from "@/components/ops/copy-button";
import { StatusBoard, type BoardItem } from "@/components/ops/status-board";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat";
import { cn } from "@/lib/utils";
import { monitorTargets } from "@/server/ops";
import { coherence, liveOps } from "@/server/ops-live";
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
};

export default async function Page() {
  const [live, targets, coh, h] = await Promise.all([liveOps(), monitorTargets().catch(() => null), coherence().catch(() => null), headers()]);
  const vaultByUrl = new Map((targets ?? []).map((t) => [norm(t.url), t]));
  const board: BoardItem[] = live.status.map((s) => {
    const v = vaultByUrl.get(norm(s.url));
    return { url: s.url, name: v?.name && v.name.length < 40 ? `${s.name}` : s.name, group: v?.group ?? s.group ?? "Fora da nota do vault", ok: s.ok, unstable: s.ok && s.fails > 0, status: s.statusCode, error: s.error, ms: s.latencyMs, checkedAt: s.checkedAt.toISOString(), since: s.changedAt.toISOString(), source: live.monitors.find((m) => m.source === s.source)?.label ?? s.source };
  });
  const groupOrder = [...new Set((targets ?? []).map((t) => t.group))];
  const openIncidents = live.events.filter((e) => e.kind === "site_down" && !e.resolvedAt);
  const wf24 = live.events.filter((e) => e.kind === "workflow_error" && Date.now() - e.createdAt.getTime() < 86_400_000);
  const soonDomains = live.domains.filter((d) => d.expiresAt && d.expiresAt.getTime() - Date.now() < 45 * 86_400_000);
  const silent = live.monitors.filter((m) => m.silent);

  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "orbita";
  const base = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
  let monitorNote: string | null = null;
  monitorNote = (await getVaultIndexSafe())?.resolve("Monitoramento de Disponibilidade") ?? null;

  const tiles = [
    { label: "No ar agora", value: board.length ? `${board.filter((b) => b.ok).length}/${board.length}` : "—", icon: Activity, tone: board.some((b) => !b.ok) ? "text-danger" : board.length ? "text-success" : "" },
    { label: "Incidentes abertos", value: String(openIncidents.length), icon: XCircle, tone: openIncidents.length ? "text-danger" : "" },
    { label: "Falhas de workflow (24h)", value: String(wf24.length), icon: AlertTriangle, tone: wf24.length ? "text-warning" : "" },
    { label: "Domínios < 45 dias", value: String(soonDomains.length), icon: Globe, tone: soonDomains.length ? "text-warning" : "" },
    { label: "Monitores", value: live.monitors.length ? `${live.monitors.length - silent.length}/${live.monitors.length}` : "—", icon: HeartPulse, tone: silent.length ? "text-danger" : "" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6">
      <PageHeader icon={<Gauge />} title="Operação" description="Estado ao vivo da AG LABS. O inventário (servidores, agentes, apps) está no Vault; aqui fica só o que está acontecendo agora." />
      <VaultBanner />

      {silent.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-danger/40 bg-danger/8 p-4 text-[13.5px]">
          <Radio className="mt-0.5 size-4 shrink-0 text-danger" />
          <div><b>Monitor em silêncio:</b> {silent.map((m) => `${m.label} (última batida ${ago(m.lastSeen)})`).join(", ")}. Silêncio não é o mesmo que “tudo certo” — confira o n8n.</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map((t) => (
          <StatTile key={t.label} icon={t.icon} label={t.label} value={t.value} tone={t.tone === "text-danger" ? "danger" : t.tone === "text-warning" ? "warning" : t.tone === "text-success" ? "success" : "neutral"} />
        ))}
      </div>

      {live.monitors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {live.monitors.map((m) => (
            <span key={m.source} className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px]", m.silent ? "border-danger/40 text-danger" : "border-border text-muted")}>
              <span className={cn("size-2 rounded-full", m.silent ? "bg-danger" : "animate-pulse bg-success")} />
              {m.label} · {ago(m.lastSeen)}
            </span>
          ))}
        </div>
      )}

      <StatusBoard initial={board} groupOrder={groupOrder} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<Activity />} title="Incidentes e eventos" meta="últimos 14 dias" href="/operacao/automacoes" hrefLabel="Automações" />
          <div className="max-h-[420px] overflow-y-auto px-3 pb-4">
            {live.events.length === 0 && <p className="px-2 text-[13px] text-muted">Nenhum evento registrado.</p>}
            {live.events.map((e) => {
              const st = EVENT_STYLE[e.kind] ?? { icon: Activity, tone: "text-muted", label: e.kind };
              const d = e.detail as { url?: string; message?: string; node?: string; executionUrl?: string; error?: string; status?: number };
              return (
                <div key={e.id} className="flex gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
                  <st.icon className={cn("mt-0.5 size-4 shrink-0", st.tone)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 text-[13px]"><span className="truncate font-medium">{e.subject}</span><span className={cn("shrink-0 text-[11.5px]", st.tone)}>{st.label}</span>{e.kind === "site_down" && e.resolvedAt && <span className="text-[11px] text-faint">resolvido</span>}</div>
                    <div className="truncate text-[12px] text-faint">{d.message ?? d.error ?? (d.status ? `HTTP ${d.status}` : d.url) ?? ""}{d.node ? ` · nó ${d.node}` : ""}</div>
                  </div>
                  <div className="shrink-0 text-right text-[11px] text-faint">
                    {e.createdAt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    {d.executionUrl && <a href={d.executionUrl} target="_blank" rel="noreferrer" className="block text-accent hover:underline">execução ↗</a>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Globe />} title="Domínios" meta="vencimento (RDAP via n8n)" />
          <div className="px-5 pb-5">
            {live.domains.length === 0 && <p className="text-[13px] text-muted">Nenhum domínio recebido ainda. O monitor de vencimento envia a lista quando ligado à Órbita.</p>}
            <div className="space-y-2">
              {live.domains.map((d) => {
                const days = d.expiresAt ? Math.ceil((d.expiresAt.getTime() - Date.now()) / 86_400_000) : null;
                return (
                  <div key={d.domain} className="flex items-center gap-3 text-[13px]">
                    <span className={cn("w-16 shrink-0 rounded-md px-1.5 py-0.5 text-center text-[11.5px] font-semibold tabular-nums", days === null ? "bg-surface-2 text-faint" : days < 8 ? "bg-danger/15 text-danger" : days < 45 ? "bg-warning/15 text-warning" : "bg-success/12 text-success")}>
                      {days === null ? "?" : days < 0 ? "vencido" : `${days}d`}
                    </span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{d.domain}</span><span className="block truncate text-[11.5px] text-faint">{d.error ?? d.depends}</span></span>
                    <span className="shrink-0 text-[11.5px] text-faint">{d.expiresAt?.toLocaleDateString("pt-BR") ?? ""}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<CheckCircle2 />} title="Coerência vault × monitor" href={monitorNote ? `/vault?p=${encodeURIComponent(monitorNote)}` : undefined} hrefLabel="Nota no vault" />
          <div className="space-y-3 px-5 pb-5 text-[13px]">
            {!coh && <p className="text-muted">Conecte o vault para comparar.</p>}
            {coh && coh.monitoredCount === 0 && <p className="text-muted">A nota do vault lista {coh.vaultCount} endereços. Assim que o n8n enviar resultados, a Órbita mostra aqui o que está fora de sincronia.</p>}
            {coh && coh.monitoredCount > 0 && coh.notMonitored.length === 0 && coh.notInVault.length === 0 && <p className="text-success">Tudo coerente: o monitor verifica exatamente o que o vault lista ({coh.vaultCount}).</p>}
            {coh && coh.monitoredCount > 0 && coh.notMonitored.length > 0 && (
              <div><div className="mb-1 font-medium text-warning">No vault, mas ninguém está verificando ({coh.notMonitored.length})</div>{coh.notMonitored.map((t) => <div key={t.url} className="truncate text-[12.5px] text-muted">{t.priority} · {t.url}</div>)}</div>
            )}
            {coh && coh.notInVault.length > 0 && (
              <div><div className="mb-1 font-medium text-warning">Verificado, mas fora da nota do vault ({coh.notInVault.length})</div>{coh.notInVault.map((t) => <div key={t.url} className="truncate text-[12.5px] text-muted">{t.name} · {t.url}</div>)}</div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Plug />} title="Integração com o n8n" href="/integracoes" hrefLabel="Detalhes" />
          <div className="space-y-3 px-5 pb-5 text-[13px] text-muted">
            <p>O n8n continua coletando; a Órbita guarda o histórico e mostra o estado. A lista de endereços sai da nota do vault.</p>
            <Endpoint method="GET" url={`${base}/api/ops/alvos`} note="lista do vault para o n8n verificar" />
            <Endpoint method="POST" url={`${base}/api/ops/ingest`} note="n8n envia links, domínios e falhas" />
            <p className="text-[12px] text-faint">Os dois usam <code>Authorization: Bearer OPS_TOKEN</code>.</p>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader icon={<Bot />} title="Contexto para agentes" />
        <div className="flex flex-wrap items-center gap-3 px-5 pb-5 text-[13px] text-muted">
          <p className="min-w-[260px] flex-1">Para um agente novo: devolve em markdown as regras do vault, agentes, servidores, apps, automações e o estado ao vivo — sem dados pessoais nem segredos.</p>
          <CopyButton text={`curl -H "Authorization: Bearer $CONTEXT_TOKEN" "${base}/api/context?format=md&live=1"`} label="Copiar curl" />
          <Link href="/api/context?format=md" target="_blank" className="flex items-center gap-1 text-[12.5px] text-accent hover:underline">Prévia <ArrowUpRight className="size-3.5" /></Link>
        </div>
      </Card>
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
