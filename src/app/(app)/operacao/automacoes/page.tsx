import { AlertTriangle, CheckCircle2, CircleDashed, Workflow, XCircle } from "lucide-react";
import Link from "next/link";
import { Card, PageHeader, SectionLabel } from "@/components/ui/card";
import { BarRows, Big, ColumnBars, Legend, Ring, ShareStrip, WidgetShell, dayKey, lastDays } from "@/components/ui/mini-charts";
import { WidgetBoard } from "@/components/ui/widget-board";
import type { WidgetItem } from "@/components/ui/draggable-widget-grid";
import { cn } from "@/lib/utils";
import { n8nOverview } from "@/server/ops";
import { liveOps } from "@/server/ops-live";
import { VaultBanner } from "@/components/vault/vault-banner";
import { getVaultIndexSafe } from "@/server/vault";

export const metadata = { title: "Automações" };

const when = (d: Date | string) => new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function Page() {
  const [n8n, live] = await Promise.all([n8nOverview(), liveOps()]);
  const notePath = (await getVaultIndexSafe())?.resolve("Automações Ativas") ?? null;
  const sourcesVerified = n8n.configured && n8n.instances.every((instance) => instance.ok);
  const liveIds = new Set(n8n.instances.flatMap((i) => i.workflows.map((w) => w.id)));
  const missing = sourcesVerified ? n8n.documented.filter((d) => d.id && /^[A-Za-z0-9]{8,}$/.test(d.id) && !liveIds.has(d.id) && /n8n/i.test(d.where)) : [];
  const pushed = live.events.filter((e) => e.kind === "workflow_error");
  const pushedUrls = new Set(pushed.map((event) => String(event.detail.executionUrl ?? "")).filter(Boolean));
  const apiErrors = n8n.instances.flatMap((i) => i.errors).filter((error) => !pushedUrls.has(error.url));

  const workflows = n8n.instances.flatMap((i) => i.workflows);
  const active = workflows.filter((w) => w.active);
  const documentedActive = active.filter((w) => w.documented);

  // Falhas por dia (ingestão + API), 14 dias.
  const days = lastDays(14, live.generatedAt);
  const failDays = days.map((d) => ({
    label: d.label,
    segments: [
      { name: "recebidas", tone: "warn" as const, value: pushed.filter((e) => dayKey(e.createdAt) === d.key).length },
      { name: "na API", tone: "err" as const, value: apiErrors.filter((e) => dayKey(e.startedAt) === d.key).length },
    ],
  }));
  const failTotal = pushed.length + apiErrors.length;

  // Última alteração dos workflows, por mês (6 meses).
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(live.generatedAt);
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") };
  });
  const monthKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}`; };
  const updated = months.map((m) => ({
    label: m.label,
    segments: [
      { name: "ativos", tone: "accent" as const, value: active.filter((w) => monthKey(w.updatedAt) === m.key).length },
      { name: "inativos", tone: "idle" as const, value: workflows.filter((w) => !w.active && monthKey(w.updatedAt) === m.key).length },
    ],
  }));

  const tags = [...workflows.flatMap((w) => w.tags).reduce((m, t) => m.set(t, (m.get(t) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 6);

  const failureList = (
    <ul className="-mx-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
      {failTotal === 0 && <li className="px-2 text-[12.5px] text-muted">{sourcesVerified ? "Nenhuma falha retornada pelas consultas atuais." : "Nenhuma falha recebida por ingestão. A consulta às APIs n8n está incompleta; isso não confirma ausência de falhas."}</li>}
      {pushed.map((e) => {
        const d = e.detail as { node?: string; message?: string; executionUrl?: string };
        return (
          <li key={e.id} className="flex gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-2">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
            <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-medium">{e.subject}</span><span className="block truncate text-[11.5px] text-faint">{d.node ? `nó ${d.node} · ` : ""}{d.message}</span></span>
            <span className="shrink-0 text-right text-[11px] tabular-nums text-faint">{when(e.createdAt)}{d.executionUrl && <a href={d.executionUrl} target="_blank" rel="noreferrer" className="block text-accent hover:underline">abrir ↗</a>}</span>
          </li>
        );
      })}
      {apiErrors.map((e) => (
        <li key={`${e.instance}-${e.id}`}>
          <a href={e.url} target="_blank" rel="noreferrer" className="flex gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-2">
            <XCircle className="mt-0.5 size-3.5 shrink-0 text-danger" />
            <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-medium">{e.workflowName}</span><span className="block truncate text-[11.5px] text-faint">{e.instance}</span></span>
            <span className="shrink-0 text-[11px] tabular-nums text-faint">{when(e.startedAt)}</span>
          </a>
        </li>
      ))}
    </ul>
  );

  const panels: Record<string, React.ReactNode> = {
    overview: (
      <WidgetShell title="Workflows" meta={`${n8n.instances.length} instância${n8n.instances.length === 1 ? "" : "s"}`}>
        <Big unit="ativos">{n8n.configured ? `${active.length}/${workflows.length}` : "—"}</Big>
        <ShareStrip className="mt-3" label={`${active.length} ativos e ${workflows.length - active.length} inativos`} parts={[{ name: "Ativos", value: active.length, tone: "accent" }, { name: "Inativos", value: workflows.length - active.length, tone: "idle" }]} />
        <Legend className="mt-2" items={[{ name: "ativos", tone: "accent", value: active.length }, { name: "inativos", tone: "idle", value: workflows.length - active.length }]} />
        <BarRows className="mt-auto" label="Workflows ativos por instância" max={Math.max(1, ...n8n.instances.map((i) => i.workflows.length))}
          rows={n8n.instances.map((i) => ({ key: i.name, label: i.name, value: i.workflows.filter((w) => w.active).length, display: i.ok ? `${i.workflows.filter((w) => w.active).length}/${i.workflows.length}` : "erro", tone: i.ok ? "accent" : "err", hint: i.ok ? undefined : i.error }))} />
      </WidgetShell>
    ),
    coverage: (
      <WidgetShell title="Documentação" href={notePath ? `/vault?p=${encodeURIComponent(notePath)}` : "/vault"} hrefLabel="Vault">
        <div className="flex flex-1 items-center gap-4">
          <Ring value={documentedActive.length} total={active.length} tone={documentedActive.length === active.length ? "ok" : "warn"} label={`${documentedActive.length} de ${active.length} workflows ativos documentados no vault`}>
            <span className="text-[15px] font-semibold tabular-nums">{active.length ? `${Math.round((documentedActive.length / active.length) * 100)}%` : "—"}</span>
          </Ring>
          <dl className="space-y-1.5 text-[12px]">
            <div><dt className="text-faint">Documentados</dt><dd className="font-medium tabular-nums">{documentedActive.length}</dd></div>
            <div><dt className="text-faint">Sem ficha</dt><dd className={cn("font-medium tabular-nums", active.length - documentedActive.length ? "text-warning" : "")}>{active.length - documentedActive.length}</dd></div>
          </dl>
        </div>
      </WidgetShell>
    ),
    failures: (
      <WidgetShell title="Falhas" meta="14 dias">
        <Big tone={failTotal ? "warn" : undefined} unit={failTotal === 1 ? "falha" : "falhas"}>{failTotal}</Big>
        <ColumnBars className="mt-auto" axis={[days[0].label, "hoje"]} label={`Falhas de workflow por dia: ${pushed.length} recebidas por ingestão e ${apiErrors.length} encontradas na API.`} columns={failDays} />
      </WidgetShell>
    ),
    list: (
      <WidgetShell title="Falhas recentes" meta={`${failTotal} registros`}>
        <Legend className="mb-2" items={[{ name: "recebidas pelo monitor", tone: "warn", value: pushed.length }, { name: "consultadas na API", tone: "err", value: apiErrors.length }]} />
        {failureList}
      </WidgetShell>
    ),
    missing: (
      <WidgetShell title="Fora do n8n" meta="no vault">
        <Big tone={missing.length ? "warn" : undefined} unit="não encontrados">{sourcesVerified ? missing.length : "—"}</Big>
        <ul className="mt-auto space-y-1 text-[12px] text-muted">
          {!sourcesVerified && <li className="text-faint">Requer todas as instâncias respondendo.</li>}
          {sourcesVerified && missing.length === 0 && <li className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-success" />Tudo que está documentado existe.</li>}
          {missing.slice(0, 3).map((m) => <li key={m.id} className="truncate">{m.name}</li>)}
        </ul>
      </WidgetShell>
    ),
    tags: (
      <WidgetShell title="Etiquetas" meta={`${tags.length ? "mais usadas" : ""}`}>
        {tags.length === 0 ? <p className="text-[12.5px] text-muted">Nenhuma etiqueta nos workflows.</p> : (
          <BarRows className="min-h-0 flex-1 overflow-y-auto pr-1" label="Etiquetas mais usadas nos workflows" rows={tags.map(([t, n]) => ({ key: t, label: t, value: n, display: n }))} />
        )}
      </WidgetShell>
    ),
    updated: (
      <WidgetShell title="Última alteração" meta="workflows por mês">
        <Legend items={[{ name: "ativos", tone: "accent" }, { name: "inativos", tone: "idle" }]} />
        <div className="mt-auto">
          <ColumnBars height={88} label={`Workflows por mês da última alteração, últimos 6 meses.`} columns={updated} />
          <div aria-hidden className="mt-1.5 flex text-[10.5px] capitalize text-faint">{months.map((m) => <span key={m.key} className="flex-1 text-center">{m.label}</span>)}</div>
        </div>
      </WidgetShell>
    ),
  };

  const items: WidgetItem[] = n8n.configured
    ? [
        { id: "overview", size: "wide", label: "Workflows" },
        { id: "coverage", size: "sm", label: "Documentação" },
        { id: "failures", size: "sm", label: "Falhas" },
        { id: "list", size: "lg", label: "Falhas recentes" },
        { id: "missing", size: "sm", label: "Fora do n8n" },
        { id: "tags", size: "sm", label: "Etiquetas" },
        { id: "updated", size: "wide", label: "Última alteração" },
      ]
    : [
        { id: "failures", size: "wide", label: "Falhas" },
        { id: "list", size: "wide", label: "Falhas recentes" },
      ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 sm:px-6">
      <PageHeader
        icon={<Workflow />}
        title="Automações"
        description={<>Estado ao vivo dos workflows. A descrição de cada automação está em <Link className="text-accent hover:underline" href={notePath ? `/vault?p=${encodeURIComponent(notePath)}` : "/vault"}>Automações Ativas</Link> no vault.</>}
      />
      <VaultBanner />

      {!n8n.configured && (
        <Card className="p-5 text-[13px] text-muted">
          Para listar os workflows ao vivo (ativos, inativos e quais não estão documentados no vault), crie uma chave em cada n8n (Settings → n8n API) e defina <code>N8N_INSTANCES</code>. Veja <Link href="/integracoes" className="text-accent hover:underline">Integrações</Link>.
        </Card>
      )}

      <WidgetBoard storageKey={n8n.configured ? "automacoes" : "automacoes-min"} items={items} panels={panels} />

      <section className="space-y-3">
        <SectionLabel>Inventário do vault · {n8n.documented.length} rotinas</SectionLabel>
        <p className="text-xs text-muted">Rotinas sem correspondência na consulta ao vivo, incluindo outros ambientes. As rotinas já encontradas no n8n aparecem nas tabelas abaixo. O cadastro não comprova execução.</p>
        <div className="grid gap-3 md:grid-cols-2">{n8n.documented.filter(d => !d.id || !liveIds.has(d.id)).map((d, i) => <Card key={`${d.where}:${d.id ?? d.name}:${i}`} className="p-4"><h3 className="text-sm font-medium">{d.name}</h3><p className="mt-1 text-xs text-accent">{d.where}</p><p className="mt-2 text-xs text-muted">{d.description || "Descrição não informada no vault."}</p><p className="mt-2 text-xs text-faint">{d.schedule || "Agenda não informada"} · sem estado de execução recebido</p></Card>)}</div>
      </section>
      {n8n.configured && n8n.instances.map((inst) => (
        <section key={inst.name} className="space-y-3">
          <SectionLabel>n8n · {inst.name}</SectionLabel>
          {!inst.ok ? <Card className="p-4 text-[13px] text-danger">{inst.error}</Card> : (
            <>
              <WorkflowTable url={inst.url} rows={inst.workflows.filter((w) => w.active)} />
              {inst.workflows.some((w) => !w.active) && (
                <details className="card group">
                  <summary className="cursor-pointer list-none px-5 py-3 text-[12.5px] text-muted [&::-webkit-details-marker]:hidden">Inativos · {inst.workflows.filter((w) => !w.active).length}<span className="ml-2 text-faint group-open:hidden">mostrar</span></summary>
                  <div className="border-t border-border"><WorkflowTable url={inst.url} rows={inst.workflows.filter((w) => !w.active)} bare /></div>
                </details>
              )}
            </>
          )}
        </section>
      ))}
    </div>
  );
}

function WorkflowTable({ url, rows, bare = false }: { url: string; rows: Awaited<ReturnType<typeof n8nOverview>>["instances"][number]["workflows"]; bare?: boolean }) {
  const table = (
    <table className="w-full text-[13px]">
      <thead><tr className="border-b border-border text-left text-[11.5px] text-faint"><th className="px-5 py-2.5 font-medium">Workflow</th><th className="px-3 py-2.5 font-medium">Estado</th><th className="hidden px-3 py-2.5 font-medium sm:table-cell">Vault</th><th className="px-5 py-2.5 text-right font-medium">Atualizado</th></tr></thead>
      <tbody>
        {[...rows].sort((a, b) => a.name.localeCompare(b.name)).map((w) => (
          <tr key={w.id} className="border-b border-border transition last:border-0 hover:bg-surface-2/60">
            <td className="max-w-0 px-5 py-2.5"><a href={`${url}/workflow/${w.id}`} target="_blank" rel="noreferrer" className="block truncate font-medium hover:underline">{w.name}</a></td>
            <td className="px-3 py-2.5">{w.active ? <span className="inline-flex items-center gap-1 text-[12px] text-success"><CheckCircle2 className="size-3.5" />ativo</span> : <span className="inline-flex items-center gap-1 text-[12px] text-faint"><CircleDashed className="size-3.5" />inativo</span>}</td>
            <td className="hidden px-3 py-2.5 text-[12px] sm:table-cell">{w.documented ? <span className="text-muted">documentado</span> : w.active ? <span className="text-warning">não documentado</span> : <span className="text-faint">—</span>}</td>
            <td className="px-5 py-2.5 text-right text-[12px] tabular-nums text-faint">{new Date(w.updatedAt).toLocaleDateString("pt-BR")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return bare ? <div className="overflow-x-auto">{table}</div> : <Card className="overflow-x-auto">{table}</Card>;
}
