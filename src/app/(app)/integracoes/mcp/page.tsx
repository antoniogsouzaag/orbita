import { KeyRound, Network, Plus } from "lucide-react";
import { headers } from "next/headers";
import { AgentTokens, type TokenRow } from "@/components/agents/agent-tokens";
import { CopyButton } from "@/components/ops/copy-button";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { listAgentTokens } from "@/server/agents";
import { CORE_AGENT_TOOLS } from "@/lib/agent-handbook";
export const metadata = { title: "Acessos MCP" };
export default async function Page() {
 const [tokens, h] = await Promise.all([listAgentTokens(), headers()]);
 const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
 const mcpUrl = `${host.startsWith("localhost") ? "http" : "https"}://${host}/api/mcp`;
 const rows: TokenRow[] = tokens.map(t => ({ ...t, lastUsedAt: t.lastUsedAt?.toISOString() ?? null, createdAt: t.createdAt.toISOString() }));
 return <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6"><PageHeader icon={<KeyRound />} title="Acessos e configuração MCP" description="Conecte o time e controle as permissões de cada acesso." />      <details open id="conectar-agente" className="group scroll-mt-24 rounded-2xl border border-border bg-surface/70">
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
                {CORE_AGENT_TOOLS.map(({ name, scope, description }) => (
                  <li key={name} className="flex gap-2">
                    <code className="shrink-0 font-mono text-[11.5px] text-fg">{name}</code>
                    <span className="truncate text-[12px]">{description}</span>
                    <span className="ml-auto shrink-0 rounded bg-surface-2 px-1.5 text-[11px] text-faint">{scope}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[12px] text-faint">Contexto e Status compartilham a leitura do ecossistema e do manual da empresa no vault. Administradores acessam todas as ações da IA, inclusive tarefas pessoais, agenda, finanças e CRM. As permissões pertencem ao token e podem ser ajustadas abaixo.</p>
            </div>
          </Card>

        </div>
      </div>
      </details></div>;
}
