import { Activity, Bot, CheckCircle2, Circle, Inbox, Network, XCircle } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { AgentTokens, type TokenRow } from "@/components/agents/agent-tokens";
import { CopyButton } from "@/components/ops/copy-button";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { agentTasks, listAgentTokens, recentActivity } from "@/server/agents";

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
  ["criar_tarefa_para_antonio", "tarefas", "Abre uma tarefa para você decidir ou executar"],
  ["minhas_tarefas", "tarefas", "O agente acompanha as tarefas que abriu"],
  ["registrar_evento", "eventos", "Registra deploy, manutenção ou incidente na Operação"],
] as const;

export default async function Page() {
  const [tokens, activity, inbox, h] = await Promise.all([listAgentTokens(), recentActivity(40), agentTasks(), headers()]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "orbita";
  const mcpUrl = `${host.startsWith("localhost") ? "http" : "https"}://${host}/api/mcp`;
  const rows: TokenRow[] = tokens.map((t) => ({ id: t.id, name: t.name, prefix: t.prefix, scopes: t.scopes, revoked: t.revoked, lastUsedAt: t.lastUsedAt?.toISOString() ?? null, createdAt: t.createdAt.toISOString() }));
  const open = inbox.filter((t) => t.status !== "done");

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
      <PageHeader icon={<Bot />} title="Agentes" description="A Órbita como central: cada agente (e o Claude Code ou o Codex) se conecta por MCP com um acesso próprio. A hierarquia de cada servidor e o Discord continuam como estão." />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
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
              <p className="text-[12px] text-faint">Agentes não editam o vault: mudanças no manual seguem por PR no GitHub, com sua aprovação.</p>
            </div>
          </Card>

          <Card>
            <CardHeader icon={<Inbox />} title="Pedidos dos agentes" meta={`${open.length} aberto${open.length === 1 ? "" : "s"}`} href="/tarefas" hrefLabel="Tarefas" />
            <div className="px-5 pb-5 text-[13px]">
              {inbox.length === 0 ? (
                <p className="text-muted">Quando um agente precisar de você, a tarefa aparece aqui e em Tarefas.</p>
              ) : (
                <ul className="space-y-2">
                  {inbox.slice(0, 12).map((t) => (
                    <li key={t.id} className="flex items-start gap-2">
                      {t.status === "done" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <Circle className="mt-0.5 size-4 shrink-0 text-faint" />}
                      <span className={cn("min-w-0 flex-1", t.status === "done" && "text-faint line-through")}>{t.title}</span>
                      <span className="shrink-0 text-[11.5px] text-faint">{t.tags.find((x) => x.startsWith("agente:"))?.slice(7)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader icon={<Activity />} title="Atividade" meta="o que cada agente consultou ou registrou" href="/operacao" hrefLabel="Operação" />
        <div className="px-5 pb-5 text-[13px]">
          {activity.length === 0 ? (
            <p className="text-muted">Nenhuma chamada ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {activity.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2">
                  {a.ok ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <XCircle className="size-4 shrink-0 text-danger" />}
                  <span className="shrink-0 font-medium">{a.agent}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">{a.summary}</span>
                  <code className="hidden shrink-0 font-mono text-[11px] text-faint sm:block">{a.tool}</code>
                  <span className="shrink-0 text-[12px] text-faint">{ago(a.createdAt)}</span>
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
