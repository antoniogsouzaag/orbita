import Link from "next/link";
import { MessageSquareText, ArrowUpRight } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { ANSWERED_TAG, awaitsOwner, githubSourceTag, type ProposalSource } from "@/lib/proposals";
import { githubInbox } from "@/server/github-inbox";
import { proposalSource, proposalTasks, replyAgents } from "@/server/proposals";
import { ProposalReply } from "@/components/empresa/proposal-reply";
import { ProposalContext } from "@/components/empresa/proposal-context";
import { ProposalList } from "@/components/empresa/proposal-list";
import { Card, PageHeader } from "@/components/ui/card";

export const metadata = { title: "Propostas e respostas" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAuth();
  const params = await searchParams;
  const tab = params.fila === "agentes" ? "agentes" : params.fila === "concluidas" ? "concluidas" : "voce";
  const [inbox, tasks, agents] = await Promise.all([githubInbox(), proposalTasks(), replyAgents()]);
  const agentName = (id?: string) => agents.find(agent => agent.id === id)?.name ?? id ?? "Agente";
  const asks = tasks.filter(task => !task.tags.includes(ANSWERED_TAG) && task.status !== "done");
  const decisions = inbox.items.filter(item => awaitsOwner(item, tasks));
  const rows = tab === "voce" ? [
    ...decisions.map(item => ({ key: item.url, title: item.title, meta: `${item.repo} #${item.number} · GitHub`, href: `/propostas?repo=${encodeURIComponent(item.repo)}&issue=${item.number}#resposta`, source: { kind: "github" as const, repo: item.repo, number: item.number } })),
    ...asks.map(task => ({ key: task.id, title: task.title, meta: agentName(task.tags.find(tag => tag.startsWith("agente:"))?.slice(7)), href: `/propostas?task=${task.id}#resposta`, source: { kind: "task" as const, id: task.id } })),
  ] : tasks.filter(task => task.tags.includes(ANSWERED_TAG) && (tab === "concluidas" ? task.status === "done" : task.status !== "done")).map(task => ({ key: task.id, title: task.title, meta: `${agentName(task.tags.find(tag => tag.startsWith("agente:"))?.slice(7))} · ${task.status === "doing" ? "em andamento" : task.status === "done" ? "concluída" : "na fila"}`, href: `/propostas?fila=${tab}&task=${task.id}#resposta`, source: { kind: "task" as const, id: task.id } }));
  const selected = typeof params.task === "string" && /^[a-f0-9-]{36}$/i.test(params.task) ? { kind: "task" as const, id: params.task }
    : typeof params.repo === "string" && /^[a-zA-Z0-9_.-]{1,100}$/.test(params.repo) && typeof params.issue === "string" && /^[1-9]\d*$/.test(params.issue) && Number.isSafeInteger(Number(params.issue)) ? { kind: "github" as const, repo: params.repo, number: Number(params.issue) } : null;
  const source: ProposalSource | undefined = selected ?? rows[0]?.source;
  const detail = source ? await proposalSource(source, true).catch(() => null) : null;
  const sourceTag = detail ? githubSourceTag(detail.url) : null;
  const thread = detail?.task ?? tasks.find(task => sourceTag && task.tags.includes(sourceTag));
  const agent = thread?.tags.find(tag => tag.startsWith("agente:"))?.slice(7);
  return <div className="mx-auto max-w-6xl space-y-4 px-4 sm:px-6">
    <PageHeader icon={<MessageSquareText />} title="Propostas e respostas" description="Decida, deixe contexto e acompanhe a continuidade com os agentes." />
    <nav aria-label="Filas de propostas" className="flex flex-wrap gap-2 text-xs">{[{ id: "voce", label: "Aguardando você", count: asks.length + decisions.length }, { id: "agentes", label: "Com os agentes", count: tasks.filter(t => t.tags.includes(ANSWERED_TAG) && t.status !== "done").length }, { id: "concluidas", label: "Concluídas", count: tasks.filter(t => t.tags.includes(ANSWERED_TAG) && t.status === "done").length }].map(item => <Link key={item.id} href={`/propostas?fila=${item.id}`} aria-current={tab === item.id ? "page" : undefined} className={`rounded-lg border px-3 py-2 ${tab === item.id ? "border-accent/30 bg-accent/10 text-accent" : "border-border text-muted"}`}>{item.label} <span className="ml-1 tabular-nums">{item.count}</span></Link>)}</nav>
    {(inbox.error || inbox.truncated || tasks.length === 200) && <p role="status" className="text-xs text-warning">{inbox.error ? "GitHub temporariamente indisponível; as tarefas locais continuam acessíveis. " : ""}{inbox.truncated || tasks.length === 200 ? "Consulta parcial: a lista pode conter mais itens nas origens." : ""}</p>}
    <div className="grid items-start gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
      <ProposalList key={tab} rows={rows.map(({ key, title, meta, href }) => ({ key, title, meta, href }))} selectedKey={source?.kind === "task" ? source.id : detail?.url} />
      <Card id="resposta" className="min-w-0 scroll-mt-20 space-y-4 p-4 sm:p-5">
        {detail && source ? <>
          <div>
            <h2 className="text-base font-semibold">{detail.title}</h2>
            <Link href={detail.url} target={source.kind === "github" ? "_blank" : undefined} rel={source.kind === "github" ? "noreferrer" : undefined} className="mt-2 inline-flex items-center gap-1 text-xs text-accent">Abrir origem <ArrowUpRight className="size-3" /></Link>
            {thread?.tags.includes(ANSWERED_TAG) && <p className="mt-2 text-xs text-muted">{agentName(agent)} · {thread.status === "done" ? "concluída" : thread.status === "doing" ? "em execução" : "aguardando continuidade"}</p>}
          </div>
          {params.respondida === "1" && thread?.tags.includes(ANSWERED_TAG) && <p role="status" className="text-xs text-success">Resposta salva no histórico. Continuidade registrada na tarefa.</p>}
          <div className="max-h-[45vh] overflow-auto rounded-xl bg-surface-2/50 p-3"><ProposalContext content={detail.notes || "Sem detalhes adicionais na origem."} /></div>
          {thread && source.kind === "github" && <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer text-xs font-medium">Histórico de respostas · {agentName(agent)} · {thread.status === "done" ? "concluída" : "com o agente"}</summary>
            <div className="mt-3 max-h-64 overflow-auto"><ProposalContext content={thread.notes ?? ""} /></div>
          </details>}
          <ProposalReply key={source.kind === "task" ? source.id : `${source.repo}:${source.number}`} source={source} agents={agents} defaultAgent={agent} />
        </> : <p className="text-sm text-muted">{source ? "O item não está disponível. Atualize a consulta ou escolha outro na lista." : "Escolha uma proposta para ler o contexto e responder."}</p>}
      </Card>
    </div>
  </div>;
}
