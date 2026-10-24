"use client";

import * as React from "react";
import { ArrowUpRight, ClipboardList, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { checkHermes } from "@/app/actions/hermes";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Chip } from "@/components/ui/misc";
import { directorRequests, safeEvidenceUrl, type RequestGroup } from "@/lib/director-requests";
import { agoLabel, type TeamMember } from "@/lib/team";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { AgentAvatar } from "./agent-avatar";
import type { DispatchView } from "@/server/dispatch";
import type { HermesOperation, hermesConfiguration } from "@/server/hermes";
import type { openclawConfiguration } from "@/server/openclaw";
import { HermesIntegration } from "./hermes-integration";
import { OpenclawIntegration } from "./openclaw-integration";

export type { TeamMember };

const FILTERS = [{ id: "all", label: "Todos" }, { id: "attention", label: "Atenção" }, { id: "open", label: "Em aberto" }, { id: "completed", label: "Concluídos" }] as const;
const when = (value: string) => new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

function AgentCard({ member, action, now }: { member: TeamMember; action?: React.ReactNode; now: number }) {
  const seen = agoLabel(member.lastSeen, now);
  const recent = member.lastSeen ? now - Date.parse(member.lastSeen) < 86_400_000 : false;
  return (
    <article className="card group relative flex min-w-0 flex-col p-4 transition hover:border-border-strong">
      <div className="flex gap-3">
        <AgentAvatar id={member.id} name={member.name} emoji={member.emoji} src={member.avatar} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold tracking-tight">
              {/* O link cobre o card inteiro; botões ficam acima dele. */}
              <Link href={`/agentes/${member.id}`} className="outline-none after:absolute after:inset-0 after:rounded-[18px] focus-visible:after:ring-2 focus-visible:after:ring-accent">{member.name}</Link>
            </h3>
            {member.director && <span className="shrink-0 rounded-full bg-accent/12 px-2 py-0.5 text-[10px] font-medium text-accent">Diretor</span>}
          </div>
          <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-muted" title={member.role}>{member.role || "Função ainda não documentada"}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {member.runtime && <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[10.5px] text-muted">{member.runtime}</span>}
        {member.area && <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[10.5px] text-muted">{member.area}</span>}
        {member.scopes.length > 0 && <span title={member.scopes.join(", ")} className="rounded-md bg-surface-2 px-2 py-0.5 text-[10.5px] text-muted">MCP · {member.scopes.length} escopos</span>}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted">
        <span aria-hidden className={cn("size-1.5 rounded-full", recent ? "bg-success" : seen ? "bg-faint" : "bg-surface-3")} />
        {seen ? `Ativo ${seen}` : "Nenhuma atividade registrada"}
        {member.calls > 0 && <span className="ml-auto tabular-nums text-faint">{member.calls} chamadas{member.failures ? <span className="text-danger"> · {member.failures} falhas</span> : null}</span>}
      </p>
      <p className="mb-4 mt-1.5 truncate text-[12.5px] text-fg/80" title={member.lastMessage ?? undefined}>{member.lastMessage ?? <span className="text-faint">Nenhuma mensagem ainda</span>}</p>

      <div className="mt-auto flex min-h-11 items-center gap-1.5 border-t border-border pt-3">
        {action && <div className="relative z-10 flex items-center gap-1.5">{action}</div>}
        {member.vaultStatus && !action && <span className="min-w-0 truncate text-[11px] text-faint" title="Status documentado no vault">{member.vaultStatus}</span>}
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[12px] text-muted transition group-hover:text-fg">Ver ficha<ArrowUpRight className="size-3.5" /></span>
      </div>
    </article>
  );
}

export function DirectorsPanel({ members, tomConfig, oracleConfig, tomInitial, oracleInitial }: {
  members: TeamMember[];
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
  const [now] = React.useState(() => Date.now());
  const rows = directorRequests(tom, oracle);
  const selected = rows.filter(row => agent === "all" || row.agent === agent);
  const visible = selected.filter(row => filter === "all" || row.group === filter);
  const oracleReady = oracleConfig.enabled && oracleConfig.endpointConfigured && oracleConfig.secretConfigured;

  // Para diretores, a última troca de pedidos conta como atividade e mensagem.
  const team = members.map((m) => {
    if (m.director === "tom" && tom[0]) {
      const last = tom[0];
      const at = new Date(last.finishedAt ?? last.createdAt).toISOString();
      return { ...m, lastSeen: !m.lastSeen || Date.parse(at) > Date.parse(m.lastSeen) ? at : m.lastSeen, lastMessage: last.summary ?? last.detail ?? m.lastMessage };
    }
    if (m.director === "oracle" && oracle[0]) {
      const last = oracle[0];
      const at = new Date(last.checkedAt).toISOString();
      return { ...m, lastSeen: !m.lastSeen || Date.parse(at) > Date.parse(m.lastSeen) ? at : m.lastSeen, lastMessage: last.detail ?? m.lastMessage };
    }
    return m;
  });

  return <section className="space-y-6" aria-label="Time e acompanhamento de pedidos">
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight">Time</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">Quem está na equipe e o que está fazendo.</p>
        </div>
        <span className="text-[12px] tabular-nums text-faint">{team.length} agentes</span>
      </div>
      {team.length === 0 ? (
        <Card><EmptyState title="Seu time, em uma visão" description="Mantenha o Registro de Agentes no vault ou crie acessos MCP para reunir o time aqui." /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {team.map((m) => (
            <AgentCard key={m.id} member={m} now={now} action={
              m.director === "tom" ? <OpenclawIntegration variant="action" config={tomConfig} initial={tomInitial} history={tom} onHistoryChange={setTom} hideHistory />
                : m.director === "oracle" ? <HermesIntegration variant="action" config={oracleConfig} initial={oracleInitial} history={oracle} onHistoryChange={setOracle} hideHistory />
                  : undefined
            } />
          ))}
        </div>
      )}
    </div>

    <Card className="overflow-hidden">
      <div className="space-y-4 border-b border-border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Acompanhamento dos pedidos</h3><p className="mt-1 text-xs text-muted">Envio, retorno e evidência dos diretores.</p></div><label className="flex items-center gap-2 text-xs text-muted">Agente<select aria-label="Filtrar pedidos por agente" value={agent} onChange={event => setAgent(event.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-fg"><option value="all">Todos</option><option>Tom</option><option>Hermes Oracle</option></select></label></div>
        <div role="group" aria-label="Estado dos pedidos" className="flex flex-wrap gap-2">{FILTERS.map(item => <button type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} className={`rounded-full border px-3 py-1.5 text-xs transition ${filter === item.id ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-muted hover:bg-surface-2"}`}>{item.label}<span className="ml-2 tabular-nums">{item.id === "all" ? selected.length : selected.filter(row => row.group === item.id).length}</span></button>)}</div>
      </div>
      {!visible.length ? <EmptyState icon={<ClipboardList />} title="Nenhum pedido nesta visão" description="Os pedidos manuais e seus resultados aparecem aqui. Você pode trocar os filtros acima." /> : <ul className="divide-y divide-border px-5">{visible.map(row => {
        const url = row.evidence ? safeEvidenceUrl(row.evidence) : null;
        return <li key={row.key} className="py-3.5"><details><summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm"><span className="rounded-lg bg-surface-2 px-2 py-1 text-xs font-medium">{row.agent}</span><span className="min-w-0 flex-1 basis-40 truncate font-medium">{row.title}</span><Chip color={row.group === "attention" ? "var(--warning)" : row.group === "completed" ? "var(--success)" : "var(--accent)"}>{row.status}</Chip>{row.silent && <Chip color="var(--warning)">Sem retorno</Chip>}<time className="text-[11px] text-faint" dateTime={row.createdAt}>{when(row.createdAt)}</time></summary><div className="mt-3 space-y-3 rounded-xl bg-surface-2/60 p-4"><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{row.title}</p><p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-muted">{row.detail}</p>{row.evidence && <p className="break-all text-xs text-muted">Evidência: {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent underline">{row.evidence}</a> : row.evidence}</p>}<p className="text-[11px] text-faint">Última atualização: {when(row.updatedAt)} · São Paulo</p><p className="break-all font-mono text-[10px] text-faint">{row.id}</p>{row.agent === "Hermes Oracle" && <Button size="sm" disabled={!oracleReady || pending} onClick={() => start(async () => { try { const item = await checkHermes(row.id); setOracle(previous => previous.map(old => old.id === item.id ? item : old)); } catch { toast.error("Não foi possível consultar o resultado do Hermes Oracle."); } })}><RefreshCw />Consultar resultado</Button>}{row.group === "attention" && <p className="text-xs text-warning">Confira o resultado antes de considerar outro envio. Nenhum pedido é repetido automaticamente.</p>}</div></details></li>;
      })}</ul>}
      <p className="border-t border-border px-5 py-3 text-[11px] leading-relaxed text-faint">Fonte: últimos {tom.length} pedidos OpenClaw e {oracle.length} registros Hermes (inclui legado), até 30 por origem. Tom atualiza pelo botão do card; Hermes Oracle exige consulta manual ao receptor. Recebido não significa concluído.</p>
    </Card>
  </section>;
}
