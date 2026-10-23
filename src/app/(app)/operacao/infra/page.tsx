import { Bot, Code2, Server } from "lucide-react";
import Link from "next/link";
import { Card, PageHeader, SectionLabel } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { agents, appRegistry, vpsList } from "@/server/ops";

export const metadata = { title: "Infra & agentes" };

const vaultHref = (p: string | null) => (p ? `/vault?p=${encodeURIComponent(p)}` : "#");

export default async function Page() {
  const [vps, ags, apps] = await Promise.all([vpsList(), agents(), appRegistry()]);
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6">
      <PageHeader icon={<Server />} title="Infra & agentes" description="Servidores, equipe de agentes e aplicações — lidos das fichas do vault." />
      <section>
        <SectionLabel className="mb-3">Servidores</SectionLabel>
        <div className="grid gap-4 md:grid-cols-3">
          {vps.map((v) => (
            <Link key={v.path} href={vaultHref(v.path)} className="card block p-5 transition hover:border-border-strong">
              <div className="flex items-center gap-2"><Server className="size-4 text-accent" /><span className="font-semibold">{v.name}</span></div>
              <div className="mt-1 text-[12px] text-faint">{[v.provider, v.panel, v.identifier].filter(Boolean).join(" · ")}</div>
              {v.summary && <p className="mt-3 text-[13px] text-muted">{v.summary}</p>}
              {v.capacity.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">{v.capacity.map((c) => <span key={c.k} className="rounded-md bg-surface-2 px-2 py-0.5 text-[11.5px] text-muted">{c.k}: <b className="text-fg">{c.v}</b></span>)}</div>
              )}
            </Link>
          ))}
          {vps.length === 0 && <Card className="p-5 text-[13px] text-muted">Nenhuma ficha com <code>type: vps</code> encontrada no vault.</Card>}
        </div>
      </section>
      <section id="agentes">
        <SectionLabel className="mb-3">Agentes · {ags.length}</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ags.map((a) => (
            <Link key={a.name} href={vaultHref(a.path)} className="card flex gap-3 p-4 transition hover:border-border-strong">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-lg">{a.emoji}</span>
              <span className="min-w-0">
                <span className="flex items-center gap-2"><span className="font-semibold">{a.name}</span><span className={cn("rounded-full px-1.5 py-px text-[10.5px]", /ativo/i.test(a.status) ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>{a.status}</span></span>
                <span className="block text-[12px] text-faint">{a.area}</span>
                <span className="mt-1 line-clamp-2 block text-[12.5px] text-muted">{a.role}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section id="apps">
        <SectionLabel className="mb-3">Aplicações · {apps.length}</SectionLabel>
        <Card className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-border text-left text-[12px] text-faint"><th className="px-4 py-2.5 font-medium">Repositório</th><th className="px-4 py-2.5 font-medium">Branch</th><th className="px-4 py-2.5 font-medium">Verificação</th><th className="px-4 py-2.5 font-medium">Portão</th><th className="px-4 py-2.5 font-medium">Ficha</th></tr></thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.repo} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-medium"><span className="flex items-center gap-1.5"><Code2 className="size-3.5 text-faint" />{a.repo}</span></td>
                  <td className="px-4 py-2.5 text-muted">{a.branch}</td>
                  <td className="px-4 py-2.5"><code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11.5px]">{a.check}</code></td>
                  <td className="px-4 py-2.5">{a.gate}</td>
                  <td className="px-4 py-2.5">{a.pagePath ? <Link href={vaultHref(a.pagePath)} className="text-accent hover:underline">{a.page}</Link> : <span className="text-faint">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
      <p className="flex items-center gap-1.5 text-[12px] text-faint"><Bot className="size-3.5" /> Para mudar algo aqui, edite a ficha correspondente no Vault — esta tela só lê.</p>
    </div>
  );
}
