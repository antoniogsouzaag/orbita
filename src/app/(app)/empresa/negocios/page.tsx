import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Building2, BookOpen } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/card";
import { BARBERIAS } from "@/lib/business";
import { barberiasSummary } from "@/server/business";
import { appRegistry } from "@/server/ops";

export const metadata = { title: "Negócios" };
export default async function Page() {
  const [summary, registryResult] = await Promise.all([barberiasSummary(), appRegistry().catch(() => [])]);
  const registry = registryResult.filter((item) => item.repo.split("/").at(-1) !== BARBERIAS.repo);
  const stats = [
    { label: "Canais", value: summary.channels, href: "/redes?entidade=barberias" },
    { label: "Ações abertas", value: summary.tasks, href: "/tarefas?escopo=empresa&tag=barberias" },
    { label: "Revisões", value: summary.reviews, href: "/github" },
    { label: "Monitoramento", value: summary.operation ? `${summary.operation.ok}/${summary.operation.total}` : null, href: "/operacao" },
  ];
  return <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
    <PageHeader icon={<Building2 />} title="Negócios" description="Cada produto com sua operação, canais e próximas decisões." />
    <Card className="max-w-2xl overflow-hidden border-amber-400/20 bg-gradient-to-br from-amber-500/10 via-surface to-surface">
      <Link href="/empresa/negocios/barberias" className="group flex items-center gap-4 p-5 sm:p-6">
        <div className="grid size-16 shrink-0 place-items-center rounded-2xl border border-amber-400/20 bg-black/20"><Image src={BARBERIAS.logo} alt="" width={56} height={56} className="size-14 object-contain" /></div>
        <div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-[.2em] text-amber-400">Produto AG LABS</p><h2 className="mt-1 text-xl font-semibold">Barberias</h2><p className="mt-1 text-xs text-muted">Gestão e agendamento para barbearias</p></div>
        <ArrowRight className="size-5 shrink-0 text-faint transition group-hover:translate-x-1 group-hover:text-amber-300" />
      </Link>
      <div className="grid grid-cols-2 border-t border-border/60 sm:grid-cols-4">{stats.map((item) => <Link key={item.label} href={item.href} prefetch={false} className="border-r border-border/40 px-5 py-4 transition last:border-r-0 hover:bg-surface-2"><p className="text-xl font-semibold tabular-nums">{item.value ?? "—"}</p><p className="mt-1 text-[11px] text-muted">{item.label}</p></Link>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-5 py-3"><p className="text-[10px] text-faint">Fontes: Postiz, tarefas empresariais, GitHub e monitores. — indica fonte indisponível.</p><Link href="/empresa/negocios/barberias" className="text-xs font-medium text-amber-300 hover:underline">Abrir negócio ↗</Link></div>
    </Card>
    {registry.length > 0 && <section className="max-w-4xl"><h2 className="flex items-center gap-2 text-sm font-semibold"><BookOpen className="size-4 text-muted" />Aplicações documentadas</h2><p className="mt-2 text-xs leading-relaxed text-muted">Registro do vault para preparar os próximos painéis. A ficha de cada aplicação reúne seu contexto e as regras de evolução.</p><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{registry.filter((item) => item.pagePath).map((item) => <Link key={item.repo} href={`/vault?p=${encodeURIComponent(item.pagePath!)}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-xs hover:bg-surface-2"><span className="min-w-0 flex-1"><span className="block truncate font-medium">{item.page?.replace(/^Página\s*-\s*/, "") ?? item.repo}</span><span className="mt-1 block text-[10px] text-faint">Ficha no vault · {item.repo}</span></span><ArrowUpRight className="size-3.5 shrink-0 text-faint" /></Link>)}</div></section>}
  </div>;
}
