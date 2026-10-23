import { Activity, Bot, KeyRound, Network, Plus, XCircle, CheckCircle2 } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { AgentTokens, type TokenRow } from "@/components/agents/agent-tokens";
import { AgentOperations, AgentRegistry } from "@/components/agents/operations-dashboard";
import { AgentAccessLink } from "@/components/agents/access-link";
import { CopyButton } from "@/components/ops/copy-button";
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

const TOOLS = [
  ["contexto_operacional", "contexto", "Regras do vault, agentes, servidores, apps, automações e status ao vivo"],
  ["buscar_no_vault", "contexto", "Busca nas notas do vault"],
  ["ler_nota_do_vault", "contexto", "Lê uma nota inteira do vault"],
  ["status_ao_vivo", "status", "Fora do ar, incidentes, domínios e monitores"],
  ["pendencias_github", "status", "PRs e propostas visíveis ao token configurado"],
  ["automacoes_operacionais", "status", "Workflows e falhas recentes no n8n"],
  ["criar_tarefa_para_antonio", "tarefas", "Abre uma tarefa para você decidir ou executar"],
  ["minhas_tarefas", "tarefas", "O agente acompanha as tarefas que abriu"],
  ["registrar_evento", "eventos", "Registra deploy, manutenção ou incidente na Operação"],
] as const;

export default async function Page() {
  const [tokens, activity, inbox, summary, h] = await Promise.all([listAgentTokens(), recentActivity(40), agentTasks(), agentActivitySummary(), headers()]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "orbita";
  const mcpUrl = `${host.startsWith("localhost") ? "http" : "https"}://${host}/api/mcp`;
  const rows: TokenRow[] = tokens.map((t) => ({ id: t.id, name: t.name, prefix: t.prefix, scopes: t.scopes, revoked: t.revoked, lastUsedAt: t.lastUsedAt?.toISOString() ?? null, createdAt: t.createdAt.toISOString() }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
      <PageHeader icon={<Bot />} title="Central dos agentes" description="Time, atividade e decisões em um só lugar. O contexto vem do Knowledge; a execução fica com cada agente." actions={<AgentAccessLink />} />

      <AgentOperations tokens={tokens} inbox={inbox} summary={summary} />
      <Suspense fallback={<Card className="p-5 text-xs text-muted">Consultando resumos…</Card>}><Reports /></Suspense>
      <Suspense fallback={<Card className="p-6 text-[13px] text-muted">Carregando time documentado no Knowledge…</Card>}><AgentRegistry /></Suspense>

      <details id="conectar-agente" className="group scroll-mt-24 rounded-2xl border border-border bg-surface/70">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-5"><KeyRound className="size-4 text-accent" /><div><p className="text-[14px] font-semibold">Acessos e configuração MCP</p><p className="mt-1 text-[12px] text-muted">Criar, revogar e copiar instruções para conectar cada agente.</p></div><Plus className="ml-auto size-4 text-faint transition-transform group-open:rotate-45" /></summary>
      <div className="grid gap-6 px-3 pb-3 sm:px-5 sm:pb-5 lg:grid-cols-[1.4fr_1fr]">
        <AgentTokens tokens={rows} mcpUrl={mcpUrl} />

        <div className="space-y-6">
          <Card>
            <CardHeader icon={<Network />} title="Conexão MCP" />
            <div className="space-y-3 px-5 pb-5 text-[13px] text-muted">
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-2 px-2 py-1.5 font-mono text-[12px] text-fg">{mcpUrl}</code>
                <CopyButton text={mcpUrl} />
              </div>
              <p>Transporte HTTP (Streamable), cabeçalho <code>Authorization: Bearer orb_…</code>. Funciona com Claude Code, Codex, n8n (nó MCP Client) e qualquer cliente MCP.</p>
              <ul className="space-y-1.5">
                {TOOLS.map(([name, scope, desc]) => (
                  <li key={name} className="flex gap-2">
                    <code className="shrink-0 font-mono text-[11.5px] text-fg">{name}</code>
                    <span className="truncate text-[12px]">{desc}</span>
                    <span className="ml-auto shrink-0 rounded bg-surface-2 px-1.5 text-[11px] text-faint">{scope}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[12px] text-faint">Contexto e Status compartilham a leitura do ecossistema e da memória do vault. Administradores acessam todas as ações da IA, inclusive tarefas pessoais, agenda, finanças e CRM. As permissões pertencem ao token e podem ser ajustadas abaixo.</p>
            </div>
          </Card>

        </div>
      </div>
      </details>

      <Card>
        <CardHeader icon={<Activity />} title="Linha do tempo" meta="últimas 40 chamadas MCP" href="/operacao" hrefLabel="Operação" />
        <div className="px-5 pb-5 text-[13px]">
          {activity.length === 0 ? (
            <p className="text-muted">Nenhuma chamada ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 py-3">
                  {a.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />}
                  <div className="min-w-0 flex-1"><p className="break-words text-[12px] font-semibold">{a.agent}</p><p className="mt-0.5 break-words text-[12px] text-muted">{a.summary}</p><code className="mt-1 block break-all font-mono text-[10px] text-faint">{a.tool}</code></div>
                  <time dateTime={a.createdAt.toISOString()} className="shrink-0 text-[11px] text-faint">{ago(a.createdAt)}</time>
                </li>
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
