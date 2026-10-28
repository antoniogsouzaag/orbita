import { Activity, ArrowUpRight, Circle, CircleAlert, GitPullRequest, Inbox, Network, ShieldCheck, Workflow } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { BarCompare, ChartCard, KpiCard } from "@/components/ui/revenue-charts-kpi";
import { cn } from "@/lib/utils";
import type { agentActivitySummary, agentTasks, listAgentTokens } from "@/server/agents";

export function AgentOperations({ tokens, inbox, summary }: {
  tokens: Awaited<ReturnType<typeof listAgentTokens>>;
  inbox: Awaited<ReturnType<typeof agentTasks>>;
  summary: Awaited<ReturnType<typeof agentActivitySummary>>;
}) {
  const active = tokens.filter((token) => !token.revoked);
  const open = inbox.filter((task) => task.status !== "done");
  const calls = summary.rows.reduce((total, agent) => total + agent.calls, 0);
  const failures = summary.rows.reduce((total, agent) => total + agent.failures, 0);
  const perAgent = [...summary.rows].sort((a, b) => b.calls - a.calls).slice(0, 10).map((row) => ({ agente: row.agent, sucesso: row.calls - row.failures, falhas: row.failures }));
  const since = new Date(summary.since).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

  return <>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard icon={<ShieldCheck />} label="Acessos ativos" value={active.length} hint="MCP habilitado" />
      <KpiCard icon={<Activity />} label="Chamadas em 24h" value={calls} hint="registradas pela Órbita" />
      <KpiCard icon={<Inbox />} tone={open.length ? "warning" : "neutral"} label="Pedidos abertos" value={open.length} hint="aguardando decisão" />
      <KpiCard icon={<CircleAlert />} tone={failures ? "danger" : "success"} label="Falhas em 24h" value={failures} hint={calls ? `${Math.round((failures / calls) * 100)}% das chamadas` : "nenhuma chamada na janela"} />
    </div>
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <ChartCard title="Chamadas por agente" subtitle={`MCP · últimas 24h, desde ${since}`} footer="Agrupado pelo nome do agente. Último acesso não indica que o processo continua online.">
        {perAgent.length ? (
          <BarCompare data={perAgent} xKey="agente" stacked height={Math.max(160, perAgent.length * 34)} horizontal description="Chamadas MCP por agente nas últimas 24 horas, separando sucesso e falha"
            series={[{ key: "sucesso", label: "Com sucesso", slot: 1 }, { key: "falhas", label: "Com falha", slot: 2 }]} />
        ) : <p className="py-8 text-center text-[13px] text-muted">Nenhuma chamada MCP nas últimas 24 horas.</p>}
      </ChartCard>
      <div className="space-y-4">
        <Card>
          <CardHeader icon={<Inbox />} title="Decisões para você" meta={`${open.length} abertas`} href="/tarefas?escopo=empresa" hrefLabel="Tarefas" />
          {!open.length ? <EmptyState icon={<Inbox />} title="Nenhum pedido aberto" description="Os agentes podem criar pedidos com contexto, prioridade e prazo pelo MCP." /> : <ul className="divide-y divide-border px-5 pb-2">{open.slice(0, 6).map((task) => <li key={task.id}><Link href={`/tarefas?escopo=empresa&task=${task.id}`} className="flex items-start gap-2 py-2.5"><Circle className={cn("mt-0.5 size-3.5 shrink-0", task.priority >= 3 ? "text-danger" : "text-faint")} /><div className="min-w-0"><p className="truncate text-[13px]">{task.title}</p><p className="mt-0.5 text-[11px] text-faint">{task.tags.find((tag) => tag.startsWith("agente:"))?.slice(7) ?? "Agente"}{task.dueDate ? ` · prazo ${task.dueDate.split("-").reverse().join("/")}` : ""}</p></div><ArrowUpRight className="ml-auto mt-0.5 size-3.5 shrink-0 text-faint" /></Link></li>)}</ul>}
        </Card>
        <div className="grid grid-cols-2 gap-2">{[{ href: "/operacao", label: "Status ao vivo", icon: Activity }, { href: "/operacao/automacoes", label: "Automações", icon: Workflow }, { href: "/github", label: "PRs e issues", icon: GitPullRequest }, { href: "/integracoes", label: "Conexões", icon: Network }].map((link) => <Link key={link.href} href={link.href} className="card flex items-center gap-2 p-3 text-[12.5px] text-muted transition hover:border-border-strong hover:text-fg"><link.icon className="size-4 text-accent" />{link.label}</Link>)}</div>
      </div>
    </div>
  </>;
}
