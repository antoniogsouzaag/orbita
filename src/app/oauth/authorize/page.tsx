import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { OAuthError, parseAuthorization } from "@/server/mcp-oauth";
import { consentOAuth } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conectar Órbita" };
const labels: Record<string, string> = {
  contexto: "Ler contexto operacional e notas do vault",
  status: "Consultar operação, GitHub e automações",
  tarefas: "Criar e administrar tarefas empresariais do agente",
  eventos: "Registrar eventos e resultados de pedidos",
  admin: "Administrador: todas as ferramentas, inclusive dados pessoais, finanças, agenda e ações do CRM",
};
export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach(v => query.append(key, v));
    else if (value !== undefined) query.append(key, value);
  }
  if (!(await isAuthenticated())) redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${query}`)}`);
  let auth;
  try { auth = await parseAuthorization(query); }
  catch (error) {
    if (!(error instanceof OAuthError)) throw error;
    return <main className="mx-auto max-w-lg px-5 py-16"><h1 className="text-xl font-semibold">Não foi possível conectar</h1><p className="mt-3 text-muted">{error.message}</p><a href="/integracoes/mcp" className="mt-5 inline-block underline">Voltar aos acessos MCP</a></main>;
  }
  return <main className="mx-auto max-w-lg space-y-6 px-5 py-12 sm:py-20">
    <div><p className="text-sm text-muted">Conexão com a Órbita</p><h1 className="mt-2 text-2xl font-semibold">Autorizar {auth.clientName}?</h1></div>
    <p>Escolha o que esta conexão poderá fazer. Você pode revogar o acesso em Integrações → Acessos MCP.</p>
    <p className="break-all text-sm text-muted">Destino da conexão: {new URL(auth.redirectUri).origin}. O nome do cliente é informado pelo aplicativo que iniciou o pedido.</p>
    <form action={consentOAuth.bind(null, query.toString())} className="space-y-5">
      {query.get("consent_error") === "scope" && <p role="alert" className="text-danger">Selecione pelo menos uma das permissões solicitadas antes de autorizar.</p>}
      <fieldset className="space-y-3"><legend className="mb-3 font-medium">Permissões solicitadas</legend>
        {auth.scopes.map(scope => <label key={scope} className="flex gap-3 rounded-xl border border-border p-4"><input type="checkbox" name="scope" value={scope} defaultChecked={scope !== "admin"} className="mt-1" /><span>{labels[scope]}</span></label>)}
      </fieldset>
      <p className="text-sm text-muted">A conexão renova o acesso automaticamente por até 30 dias. Depois, será necessário conectar novamente.</p>
      <div className="flex flex-wrap gap-3"><button name="decision" value="allow" className="rounded-lg bg-accent px-4 py-2 font-medium text-black">Autorizar conexão</button><button name="decision" value="deny" className="rounded-lg border border-border px-4 py-2">Cancelar</button></div>
    </form>
  </main>;
}
