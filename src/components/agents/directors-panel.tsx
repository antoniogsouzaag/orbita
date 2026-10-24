"use client";

import * as React from "react";
import { ClipboardList, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { checkHermes } from "@/app/actions/hermes";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Chip } from "@/components/ui/misc";
import { directorRequests, safeEvidenceUrl, type RequestGroup } from "@/lib/director-requests";
import type { DispatchView } from "@/server/dispatch";
import type { HermesOperation, hermesConfiguration } from "@/server/hermes";
import type { openclawConfiguration } from "@/server/openclaw";
import { HermesIntegration } from "./hermes-integration";
import { OpenclawIntegration } from "./openclaw-integration";

const FILTERS = [{ id: "all", label: "Todos" }, { id: "attention", label: "Atenção" }, { id: "open", label: "Em aberto" }, { id: "completed", label: "Concluídos" }] as const;
const when = (value: string) => new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export function DirectorsPanel({ tomConfig, oracleConfig, tomInitial, oracleInitial }: {
  tomConfig: ReturnType<typeof openclawConfiguration>;
  oracleConfig: ReturnType<typeof hermesConfiguration>;
  tomInitial: DispatchView[];
  oracleInitial: HermesOperation[];
}) {
  const [tom, setTom] = React.useState(tomInitial);
  const [oracle, setOracle] = React.useState(oracleInitial);
  const [filter, setFilter] = React.useState<RequestGroup | "all">("all");
  const [agent, setAgent] = React.useState("all");
  const [pending, start] = React.useTransition();
  const rows = directorRequests(tom, oracle);
  const selected = rows.filter(row => agent === "all" || row.agent === agent);
  const visible = selected.filter(row => filter === "all" || row.group === filter);
  const oracleReady = oracleConfig.enabled && oracleConfig.endpointConfigured && oracleConfig.secretConfigured;

  return <section className="space-y-4" aria-label="Diretoria e acompanhamento de pedidos">
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Diretoria</h2><span className="rounded-full border border-border px-3 py-1 text-xs text-muted">Acionamento manual</span></div>
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <OpenclawIntegration config={tomConfig} initial={tomInitial} history={tom} onHistoryChange={setTom} hideHistory />
      <HermesIntegration config={oracleConfig} initial={oracleInitial} history={oracle} onHistoryChange={setOracle} hideHistory />
    </div>
    <Card className="overflow-hidden">
      <div className="space-y-4 border-b border-border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Acompanhamento dos pedidos</h3><p className="mt-1 text-xs text-muted">Envio, retorno e evidência dos diretores.</p></div><label className="flex items-center gap-2 text-xs text-muted">Agente<select aria-label="Filtrar pedidos por agente" value={agent} onChange={event => setAgent(event.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-fg"><option value="all">Todos</option><option>Tom</option><option>Oracle</option></select></label></div>
        <div role="group" aria-label="Estado dos pedidos" className="flex flex-wrap gap-2">{FILTERS.map(item => <button type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} className={`rounded-full border px-3 py-1.5 text-xs transition ${filter === item.id ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-muted hover:bg-surface-2"}`}>{item.label}<span className="ml-2 tabular-nums">{item.id === "all" ? selected.length : selected.filter(row => row.group === item.id).length}</span></button>)}</div>
      </div>
      {!visible.length ? <EmptyState icon={<ClipboardList />} title="Nenhum pedido nesta visão" description="Os pedidos manuais e seus resultados aparecem aqui. Você pode trocar os filtros acima." /> : <ul className="divide-y divide-border px-5">{visible.map(row => {
        const url = row.evidence ? safeEvidenceUrl(row.evidence) : null;
        return <li key={row.key} className="py-4"><details><summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm"><span className="rounded-lg bg-surface-2 px-2 py-1 text-xs font-medium">{row.agent}</span><span className="min-w-0 flex-1 basis-40 truncate font-medium">{row.title}</span><Chip color={row.group === "attention" ? "var(--warning)" : row.group === "completed" ? "var(--success)" : "var(--accent)"}>{row.status}</Chip>{row.silent && <Chip color="var(--warning)">Sem retorno</Chip>}<time className="text-[11px] text-faint" dateTime={row.createdAt}>{when(row.createdAt)}</time></summary><div className="mt-3 space-y-3 rounded-xl bg-surface-2/60 p-4"><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{row.title}</p><p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-muted">{row.detail}</p>{row.evidence && <p className="break-all text-xs text-muted">Evidência: {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent underline">{row.evidence}</a> : row.evidence}</p>}<p className="text-[11px] text-faint">Última atualização: {when(row.updatedAt)} · São Paulo</p><p className="break-all font-mono text-[10px] text-faint">{row.id}</p>{row.agent === "Oracle" && <Button size="sm" disabled={!oracleReady || pending} onClick={() => start(async () => { try { const item = await checkHermes(row.id); setOracle(previous => previous.map(old => old.id === item.id ? item : old)); } catch { toast.error("Não foi possível consultar o resultado do Oracle."); } })}><RefreshCw />Consultar resultado</Button>}{row.group === "attention" && <p className="text-xs text-warning">Confira o resultado antes de considerar outro envio. Nenhum pedido é repetido automaticamente.</p>}</div></details></li>;
      })}</ul>}
      <p className="border-t border-border px-5 py-3 text-[11px] leading-relaxed text-faint">Fonte: últimos {tom.length} pedidos OpenClaw e {oracle.length} registros Hermes (inclui legado), até 30 por origem. Contagens referem-se a esta amostra. Tom atualiza pelo botão do card; Oracle exige consulta manual ao receptor. Recebido não significa concluído.</p>
    </Card>
  </section>;
}
