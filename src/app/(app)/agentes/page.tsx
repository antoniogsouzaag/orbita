import { DirectorsPanel } from "@/components/agents/directors-panel";
import { openclawConfiguration } from "@/server/openclaw";
import { listDispatches, toView } from "@/server/dispatch";
import { hermesConfiguration, hermesHistory } from "@/server/hermes";
import { Activity, Bot, XCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AgentOperations, AgentRegistry } from "@/components/agents/operations-dashboard";
import { AgentAccessLink } from "@/components/agents/access-link";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { agentActivitySummary, agentTasks, listAgentTokens, recentActivity } from "@/server/agents";
import { agentReports } from "@/server/agent-reports";

export const metadata = { title: "Agentes" };

function ago(d: Date) {
  const m = Math.round((Date.now() - d.getTime()) / 60_000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `há ${h}h` : `há ${Math.round(h / 24)} dias`;
}

export default async function Page() {
  const [tokens, activity, inbox, summary, history, openclaw] = await Promise.all([listAgentTokens(), recentActivity(40), agentTasks(), agentActivitySummary(), hermesHistory(), listDispatches({ target: "openclaw" })]);

  const groupedActivity = new Map<string, typeof activity>();
  for (const call of activity) {
    const calls = groupedActivity.get(call.agent) ?? [];
    calls.push(call);
    groupedActivity.set(call.agent, calls);
  }
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
      <PageHeader icon={<Bot />} title="Central dos agentes" description="Time, atividade e decisões em um só lugar. O contexto vem do Knowledge; a execução fica com cada agente." actions={<AgentAccessLink />} />

      <DirectorsPanel tomConfig={openclawConfiguration()} oracleConfig={hermesConfiguration()} tomInitial={openclaw.map(row => toView(row))} oracleInitial={history} />
      <AgentOperations tokens={tokens} inbox={inbox} summary={summary} />
      <Suspense fallback={<Card className="p-5 text-xs text-muted">Consultando resumos…</Card>}><Reports /></Suspense>
      <Suspense fallback={<Card className="p-6 text-[13px] text-muted">Carregando time documentado no Knowledge…</Card>}><AgentRegistry /></Suspense>



      <Card>
        <CardHeader icon={<Activity />} title="Atividade por agente" meta="últimas 40 chamadas MCP" href="/operacao" hrefLabel="Operação" />
        <div className="px-5 pb-5 text-[13px]">
          {activity.length === 0 ? (
            <p className="text-muted">Nenhuma chamada ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {[...groupedActivity].map(([agent, calls]) => (
                <li key={agent} className="py-3"><details><summary className="flex cursor-pointer items-center gap-3 text-sm"><Bot className="size-4 text-accent" /><span className="font-medium">{agent}</span><span className="ml-auto text-xs text-muted">{calls.length} chamadas · {calls.filter(call => !call.ok).length} falhas</span></summary><ul className="mt-3 divide-y divide-border pl-7">{calls.map(a => <li key={a.id} className="flex items-start gap-3 py-2">
                  {a.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />}
                  <div className="min-w-0 flex-1"><p className="break-words text-[12px] font-semibold">{a.agent}</p><p className="mt-0.5 break-words text-[12px] text-muted">{a.summary}</p><code className="mt-1 block break-all font-mono text-[10px] text-faint">{a.tool}</code></div>
                  <time dateTime={a.createdAt.toISOString()} className="shrink-0 text-[11px] text-faint">{ago(a.createdAt)}</time>
                </li>)}</ul></details></li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <p className="text-center text-[12px] text-faint">
        Prefere só leitura simples? <Link href="/integracoes" className="underline">GET /api/context</Link> continua disponível com o CONTEXT_TOKEN.
      </p>
    </div>
  );
}

async function Reports() {
  const reports = await agentReports();
  return <Card className="p-5"><h2 className="text-sm font-semibold">Resumos dos agentes · últimas 24h</h2>
    <p className="my-2 text-xs text-muted">Cada agente envia pelo MCP em registrar_evento com tipo resumo. O último relato de cada origem entra no bom dia. Triagem detalhada e dados de clientes continuam no CRM.</p>
    {!reports.length ? <p className="text-xs text-faint">Nenhum resumo recebido nesta janela. O recebimento pelo Léo ainda precisa ser conectado.</p> : <ul className="divide-y divide-border">{reports.map((report) => <li key={report.id} className="py-3 text-xs"><p className="font-medium">{report.subject}</p><p className="mt-1 whitespace-pre-wrap text-muted">{String(report.detail.message ?? "")}</p><p className="mt-2 text-faint">{report.source} · {report.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p></li>)}</ul>}
  </Card>;
}
