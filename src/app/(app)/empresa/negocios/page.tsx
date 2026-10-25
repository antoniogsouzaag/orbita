import { Suspense } from "react";
import { ProductPortfolio } from "@/components/empresa/product-portfolio";
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
  const registry = registryResult.filter((item) => item.repo.split("/").at(-1) !== BARBERIAS.repo && item.pagePath);
  const stats = [
    { label: "Canais", value: summary.channels, href: "/redes?entidade=barberias" },
    { label: "Ações abertas", value: summary.tasks, href: "/tarefas?escopo=empresa&tag=barberias" },
    { label: "Revisões", value: summary.reviews, href: "/github" },
    { label: "No ar", value: summary.operation ? `${summary.operation.ok}/${summary.operation.total}` : null, href: "/operacao" },
  ];
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 sm:px-6">
      <PageHeader icon={<Building2 />} title="Negócios" description="Cada produto com sua operação, canais e próximas decisões." />

      <Card className="overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Link href="/empresa/negocios/barberias" className="group flex items-center gap-4 bg-gradient-to-br from-amber-500/10 to-transparent p-4">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-amber-400/20 bg-black/20"><Image src={BARBERIAS.logo} alt="" width={48} height={48} className="size-12 object-contain" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-semibold uppercase tracking-[.16em] text-amber-500">Produto em destaque</p>
              <h2 className="mt-0.5 text-[18px] font-semibold tracking-tight">Barberias</h2>
              <p className="mt-0.5 truncate text-[12px] text-muted">Gestão e agendamento para barbearias</p>
            </div>
            <ArrowRight className="size-5 shrink-0 text-faint transition group-hover:translate-x-1 group-hover:text-amber-500" />
          </Link>
          <div className="grid grid-cols-2 border-t border-border sm:grid-cols-4 lg:border-l lg:border-t-0">
            {stats.map((item) => (
              <Link key={item.label} href={item.href} prefetch={false} className="flex flex-col justify-center border-border px-4 py-3 transition hover:bg-surface-2 [&:not(:last-child)]:border-r max-sm:[&:nth-child(2)]:border-r-0 max-sm:[&:nth-child(-n+2)]:border-b">
                <span className="text-[20px] font-semibold tabular-nums leading-none">{item.value ?? "—"}</span>
                <span className="mt-1.5 text-[11.5px] text-muted">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </Card>

      <Suspense fallback={<PortfolioLoading />}><ProductPortfolio /></Suspense>

      {registry.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint"><BookOpen className="size-3.5" />Aplicações documentadas</h2>
            <p className="mt-1.5 text-[12px] text-muted">Registro do vault para preparar os próximos painéis.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {registry.map((item) => (
              <Link key={item.repo} href={`/vault?p=${encodeURIComponent(item.pagePath!)}`} className="card flex min-w-0 items-center gap-3 px-4 py-3 text-[12.5px] transition hover:border-border-strong">
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{item.page?.replace(/^Página\s*-\s*/, "") ?? item.repo}</span><span className="mt-0.5 block truncate text-[11px] text-faint">{item.repo}</span></span>
                <ArrowUpRight className="size-3.5 shrink-0 text-faint" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PortfolioLoading() {
  return (
    <div role="status" aria-label="Consultando o CRM" className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="card h-[104px] p-4"><div className="loading-shimmer h-3 w-1/2 rounded" /><div className="loading-shimmer mt-4 h-6 w-1/3 rounded" /></div>)}</div>
      <div className="grid gap-3 lg:grid-cols-2">{Array.from({ length: 2 }, (_, i) => <div key={i} className="card h-[300px] p-4"><div className="loading-shimmer h-3 w-1/3 rounded" /><div className="loading-shimmer mt-6 h-[200px] rounded-xl" /></div>)}</div>
    </div>
  );
}
