import { KeyRound, Network } from "lucide-react";
import { AgentTokens, type TokenRow } from "@/components/agents/agent-tokens";
import { CopyButton } from "@/components/ops/copy-button";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { listAgentTokens } from "@/server/agents";
import { agentToolCatalog } from "@/server/agent-catalog";
import { ToolCatalog } from "@/components/agents/tool-catalog";
import { DEFAULT_MCP_SCOPES, oauthResource } from "@/server/mcp-oauth";
export const metadata = { title: "Acessos MCP" };
export default async function Page() {
 const tokens = await listAgentTokens();
 const mcpUrl = oauthResource();
 const codexConfig = `[mcp_servers.orbita]\nurl = ${JSON.stringify(mcpUrl)}\noauth_resource = ${JSON.stringify(mcpUrl)}\nscopes = ${JSON.stringify(DEFAULT_MCP_SCOPES)}\nstartup_timeout_sec = 30`;
 const codexCommands = `codex mcp add orbita --url ${mcpUrl} --oauth-resource ${mcpUrl}\ncodex mcp login orbita --scopes ${DEFAULT_MCP_SCOPES.join(",")}`;
 const rows: TokenRow[] = tokens.map(t => ({ ...t, lastUsedAt: t.lastUsedAt?.toISOString() ?? null, createdAt: t.createdAt.toISOString() }));
 return <div className="mx-auto max-w-6xl space-y-5 px-4 sm:px-6">
   <PageHeader icon={<KeyRound />} title="Acessos MCP" description="Conecte agentes e gerencie as permissões de cada acesso." />
   <Card>
     <CardHeader icon={<Network />} title="Conexão" />
     <div className="space-y-3 px-5 pb-5 text-sm">
       <div className="flex min-w-0 items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-lg bg-surface-2 px-3 py-2 text-xs">{mcpUrl}</code><CopyButton text={mcpUrl} /></div>
       <p className="text-xs text-muted">Streamable HTTP · OAuth com sua conta Órbita ou token individual de agente.</p>
       <div className="space-y-3 rounded-xl border border-border p-4">
         <h2 className="font-medium">Conectar o Codex com OAuth</h2>
         <p className="text-muted">Nas configurações de MCP do Codex, adicione o endereço acima, conecte com OAuth e autorize na Órbita. Use Contexto e Status para leitura; as demais permissões dependem da sua seleção no consentimento.</p>
         <p className="text-muted">Pelo terminal, em uma instalação nova:</p>
         <div className="flex min-w-0 items-start gap-2"><pre className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs">{codexCommands}</pre><CopyButton text={codexCommands} /></div>
         <details>
           <summary className="cursor-pointer text-muted">Configuração manual do Codex</summary>
           <p className="my-2 text-xs text-muted">Em ~/.codex/config.toml, use uma única entrada orbita. Depois execute codex mcp login orbita. Se já usa um token Bearer, confira essa entrada antes de mudar para OAuth.</p>
           <div className="flex min-w-0 items-start gap-2"><pre className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs">{codexConfig}</pre><CopyButton text={codexConfig} /></div>
         </details>
         <p className="text-xs text-muted">Depois de autorizar, abra um novo chat e peça para chamar documentacao com secao inicio. A resposta confirma o uso real da conexão. O último uso também aparece na lista abaixo.</p>
         <details>
           <summary className="cursor-pointer text-muted">Resolver falhas de conexão</summary>
           <ul className="mt-2 list-disc space-y-2 pl-5 text-xs text-muted">
             <li>401 ou credencial expirada: execute codex mcp login orbita para autorizar novamente.</li>
             <li>Cliente ou callback não cadastrado: inicie um novo login pelo Codex; links antigos de autorização podem ter outra porta local.</li>
             <li>Sem ferramentas após autorizar: confira codex mcp list e abra um novo chat. A instalação do plugin web e a conexão local do Codex têm autorizações próprias.</li>
             <li>Permissão insuficiente: confira os escopos concedidos. Para mudar o acesso, solicite os escopos necessários e autorize novamente.</li>
           </ul>
         </details>
       </div>
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
