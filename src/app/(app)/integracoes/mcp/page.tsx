import { KeyRound, Network } from "lucide-react";
import { headers } from "next/headers";
import { AgentTokens, type TokenRow } from "@/components/agents/agent-tokens";
import { CopyButton } from "@/components/ops/copy-button";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { listAgentTokens } from "@/server/agents";
import { agentToolCatalog } from "@/server/agent-catalog";
import { ToolCatalog } from "@/components/agents/tool-catalog";
export const metadata = { title: "Acessos MCP" };
export default async function Page() {
 const [tokens, h] = await Promise.all([listAgentTokens(), headers()]);
 const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
 const mcpUrl = `${host.startsWith("localhost") ? "http" : "https"}://${host}/api/mcp`;
 const rows: TokenRow[] = tokens.map(t => ({ ...t, lastUsedAt: t.lastUsedAt?.toISOString() ?? null, createdAt: t.createdAt.toISOString() }));
 return <div className="mx-auto max-w-6xl space-y-5 px-4 sm:px-6">
   <PageHeader icon={<KeyRound />} title="Acessos MCP" description="Conecte agentes e gerencie as permissões de cada acesso." />
   <Card>
     <CardHeader icon={<Network />} title="Plugin Órbita no ChatGPT e Codex" />
     <div className="space-y-3 px-5 pb-5 text-sm">
       <p>No ChatGPT, abra Plugins → Adicionar servidor MCP personalizado e use o endereço abaixo. Escolha OAuth e cadastro dinâmico (DCR), sem preencher client ID ou secret.</p>
       <p>Ao conectar, entre na Órbita e escolha as permissões. Administrador inclui dados pessoais e ações de escrita; marque somente se desejar esse acesso.</p>
       <p className="text-muted">Instale e conecte o plugin na conta em que pretende usá-lo. Uma configuração local do Codex não instala o plugin no ChatGPT web.</p>
       <a href="https://chatgpt.com/plugins" target="_blank" rel="noopener noreferrer" className="inline-block underline">Abrir plugins do ChatGPT</a>
       <p className="text-xs text-muted">Conexões OAuth aparecem na lista abaixo. Revogar o acesso bloqueia também a renovação. A conexão pode renovar por até 30 dias antes de pedir um novo login.</p>
     </div>
   </Card>
   <Card>
     <CardHeader icon={<Network />} title="Conexão" />
     <div className="space-y-3 px-5 pb-5 text-sm">
       <div className="flex min-w-0 items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-lg bg-surface-2 px-3 py-2 text-xs">{mcpUrl}</code><CopyButton text={mcpUrl} /></div>
       <p className="text-xs text-muted">HTTP Streamable · Authorization: Bearer orb_… · Claude Code, Codex, n8n e clientes MCP.</p>
     </div>
   </Card>
   <AgentTokens tokens={rows} mcpUrl={mcpUrl} />
   <details className="rounded-xl border border-border bg-surface/70 px-5 py-4">
     <summary className="cursor-pointer text-sm font-medium">Ferramentas e escopos disponíveis</summary>
     <ToolCatalog tools={agentToolCatalog()} />
     <p className="mt-4 text-xs text-muted">O token define o acesso. Administradores podem usar todas as ações da IA, inclusive dados pessoais, agenda, finanças e CRM. Consulte tools/list para o catálogo efetivo.</p>
   </details>
 </div>;
}
