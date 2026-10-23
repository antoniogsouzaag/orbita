import Link from "next/link";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { appRegistry } from "@/server/ops";
import { liveOps } from "@/server/ops-live";
import { githubInbox } from "@/server/github-inbox";

export const metadata = { title: "Negócios" };
export default async function Page() {
  const [apps, live, github] = await Promise.all([appRegistry(), liveOps(), githubInbox()]);
  return <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6"><PageHeader icon={<Building2 />} title="Negócios" description="Uma visão por aplicação, a partir do inventário canônico e das fontes conectadas." />
    <p className="text-xs text-muted">CRM mantém clientes e acompanhamento comercial. Órbita reúne operação, tarefas internas e contexto. Dados sem vínculo explícito com um produto não são atribuídos por suposição.</p>
    <div className="grid gap-4 md:grid-cols-2">{apps.map((app) => {
      const name = app.repo.split("/").at(-1) ?? app.repo;
      const prs = github.items.filter((item) => item.repo.toLowerCase() === name.toLowerCase());
      const status = live.status.filter((item) => item.group?.toLowerCase() === name.toLowerCase());
      return <section key={app.repo} className="rounded-2xl border border-border bg-surface p-5"><h2 className="text-lg font-semibold">{app.page ?? name}</h2><p className="mt-1 text-xs text-faint">{app.repo}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs"><span>{prs.length} PRs/propostas visíveis</span><span>{status.length ? `${status.filter((item) => item.ok).length}/${status.length} endereços no ar` : "Monitoramento sem grupo explicitamente vinculado"}</span></div>
        <div className="mt-5 flex flex-wrap gap-3 text-xs text-accent">{app.pagePath && <Link href={`/vault?p=${encodeURIComponent(app.pagePath)}`}>Manual ↗</Link>}<Link href="/github">Revisões ↗</Link><Link href="/operacao">Operação ↗</Link><Link href="/redes">Redes sociais ↗</Link><Link href="/tarefas?escopo=empresa">Tarefas ↗</Link></div>
      </section>;
    })}</div>{!apps.length && <p className="text-sm text-muted">O inventário de aplicações não retornou dados nesta consulta.</p>}
  </div>;
}
