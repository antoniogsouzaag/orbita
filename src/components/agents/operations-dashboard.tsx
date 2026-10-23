import { Activity, ArrowUpRight, Bot, Circle, CircleAlert, GitPullRequest, Inbox, Network, ShieldCheck, Workflow } from "lucide-react";
import Link from "next/link";
import { AgentAccessLink } from "@/components/agents/access-link";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { agentActivitySummary, agentTasks, listAgentTokens } from "@/server/agents";
import { agents } from "@/server/ops";

function ago(date: Date | null) {
  if (!date) return "aguardando primeira conexão";
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `há ${hours}h` : `há ${Math.round(hours / 24)} dias`;
}

export function AgentOperations({ tokens, inbox, summary }: {
  tokens: Awaited<ReturnType<typeof listAgentTokens>>;
  inbox: Awaited<ReturnType<typeof agentTasks>>;
  summary: Awaited<ReturnType<typeof agentActivitySummary>>;
}) {
  const active = tokens.filter((token) => !token.revoked);
  const open = inbox.filter((task) => task.status !== "done");
  const calls = summary.rows.reduce((total, agent) => total + agent.calls, 0);
  const failures = summary.rows.reduce((total, agent) => total + agent.failures, 0);
  const maxCalls = Math.max(1, ...summary.rows.map((agent) => agent.calls));
  return <>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        { label: "Acessos ativos", value: active.length, hint: "MCP habilitado", icon: ShieldCheck, color: "text-accent" },
        { label: "Chamadas em 24h", value: calls, hint: "registradas pela Órbita", icon: Activity, color: "text-accent" },
        { label: "Pedidos abertos", value: open.length, hint: "aguardando decisão", icon: Inbox, color: open.length ? "text-warning" : "text-accent" },
        { label: "Falhas em 24h", value: failures, hint: `${calls} chamadas na janela`, icon: CircleAlert, color: failures ? "text-danger" : "text-success" },
      ].map((stat) => <Card key={stat.label} className="p-4 sm:p-5"><div className="flex items-center gap-2 text-[12px] text-muted"><stat.icon className={cn("size-4", stat.color)} />{stat.label}</div><p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{stat.value}</p><p className="mt-1 text-[11px] text-faint">{stat.hint}</p></Card>)}
    </div>
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <Card>
        <CardHeader icon={<Bot />} title="Conexões e atividade" meta={`${active.length} acessos ativos`} />
        {active.length === 0 ? <EmptyState icon={<Bot />} title="Pronto para receber o time" description="Crie um acesso por agente. As conexões e chamadas reais aparecem aqui assim que o MCP for utilizado." action={<AgentAccessLink label="Criar primeiro acesso" />} /> : <ul className="space-y-3 px-5 pb-5">
          {active.map((token) => {
            const metrics = summary.rows.find((agent) => agent.agent === token.name);
            return <li key={token.id} className="rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-accent/10 text-accent"><Bot className="size-4" /></span><p className="text-[13px] font-semibold">{token.name}</p><span className={cn("ml-auto text-[10px]", token.lastUsedAt ? "text-success" : "text-faint")}>{token.lastUsedAt ? "Conexão registrada" : "Sem conexão registrada"}</span></div>
              <p className="mt-2 text-[11px] text-faint">Último acesso: {ago(token.lastUsedAt)}</p>
              <div className="mt-3 flex flex-wrap gap-1">{token.scopes.map((scope) => <span key={scope} className="rounded-md bg-surface-2 px-2 py-0.5 text-[10px] text-muted">{scope}</span>)}</div>
              <div className="mt-3 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full", metrics?.failures ? "bg-warning" : "bg-accent")} style={{ width: `${(metrics?.calls ?? 0) / maxCalls * 100}%` }} /></div><span className="text-[11px] text-faint">{metrics?.calls ?? 0} chamadas · {metrics?.failures ?? 0} falhas / 24h</span></div>
            </li>;
          })}
        </ul>}
        <p className="border-t border-border px-5 py-3 text-[11px] leading-relaxed text-faint">Janela desde {new Date(summary.since).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}. Métricas agrupadas pelo nome do agente. Último acesso não indica que o processo continua online.</p>
      </Card>
      <div className="space-y-5">
        <Card>
          <CardHeader icon={<Inbox />} title="Decisões para você" meta={`${open.length} abertas`} href="/tarefas?escopo=empresa" hrefLabel="Tarefas" />
          {!open.length ? <EmptyState icon={<Inbox />} title="Nenhum pedido aberto" description="Os agentes podem criar pedidos com contexto, prioridade e prazo pelo MCP." /> : <ul className="divide-y divide-border px-5 pb-3">{open.slice(0, 8).map((task) => <li key={task.id}><Link href={`/tarefas?escopo=empresa&task=${task.id}`} className="flex items-start gap-2 py-3"><Circle className={cn("mt-0.5 size-4 shrink-0", task.priority >= 3 ? "text-danger" : "text-faint")} /><div className="min-w-0"><p className="text-[13px] leading-relaxed">{task.title}</p><p className="mt-1 text-[11px] text-faint">{task.tags.find((tag) => tag.startsWith("agente:"))?.slice(7) ?? "Agente"}{task.dueDate ? ` · prazo ${task.dueDate.split("-").reverse().join("/")}` : ""}</p></div><ArrowUpRight className="ml-auto mt-1 size-3.5 shrink-0 text-faint" /></Link></li>)}</ul>}
        </Card>
        <Card className="p-5"><p className="text-[13px] font-semibold">Atalhos da operação</p><div className="mt-3 grid grid-cols-2 gap-2">{[{ href: "/operacao", label: "Status ao vivo", icon: Activity }, { href: "/operacao/automacoes", label: "Automações", icon: Workflow }, { href: "/github", label: "PRs e propostas", icon: GitPullRequest }, { href: "/integracoes", label: "Conexões", icon: Network }].map((link) => <Link key={link.href} href={link.href} className="flex items-center gap-2 rounded-xl border border-border p-3 text-[12px] text-muted transition hover:bg-surface-2 hover:text-fg"><link.icon className="size-4 text-accent" />{link.label}</Link>)}</div></Card>
      </div>
    </div>
  </>;
}

export async function AgentRegistry() {
  const registry = await agents();
  return <Card>
    <CardHeader icon={<Network />} title="Time do ecossistema" meta="fonte: Registro de Agentes no vault" href="/vault" hrefLabel="Vault" />
    {registry.length === 0 ? <EmptyState icon={<Bot />} title="Seu time, em uma visão" description="Conecte o Knowledge e mantenha o Registro de Agentes no vault para reunir funções, áreas e fichas operacionais aqui." /> : <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-3">{registry.map((agent, index) => <div key={`${agent.name}-${index}`} className="rounded-2xl border border-border bg-surface-2/40 p-4">
      <div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-surface text-lg">{agent.emoji}</span><div className="min-w-0"><p className="truncate text-[13px] font-semibold">{agent.name}</p><p className="text-[11px] text-faint">{agent.area}</p></div></div>
      <p className="mt-3 text-[12px] leading-relaxed text-muted">{agent.role || "Função ainda não documentada"}</p>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-faint"><span>{agent.status ? `No vault: ${agent.status}` : "Sem status documentado"}</span>{agent.path && <Link href={`/vault?p=${encodeURIComponent(agent.path)}`} className="ml-auto inline-flex items-center gap-1 text-accent">Ficha <ArrowUpRight className="size-3" /></Link>}</div>
    </div>)}</div>}
    <p className="border-t border-border px-5 py-3 text-[11px] text-faint">O status documentado descreve o agente. As chamadas MCP mostram a atividade observada na Órbita.</p>
  </Card>;
}
