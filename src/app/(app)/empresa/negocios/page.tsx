import { Suspense } from "react";
import Link from "next/link";
import { ArrowUpRight, Building2, BookOpen, MessageSquareHeart } from "lucide-react";
import { ProductPortfolio } from "@/components/empresa/product-portfolio";
import { PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BARBERIAS } from "@/lib/business";
import { appRegistry } from "@/server/ops";

export const metadata = { title: "Negócios" };

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 sm:px-6">
      <PageHeader icon={<Building2 />} title="Negócios" description="Aplicativos, indicadores e próximas decisões." actions={<Button asChild size="sm"><Link href="/empresa/feedback"><MessageSquareHeart />Feedback</Link></Button>} />
      <Suspense fallback={<PortfolioLoading />}><ProductPortfolio /></Suspense>
      <Suspense fallback={null}><DocumentedApps /></Suspense>
    </div>
  );
}

async function DocumentedApps() {
  const registry = (await appRegistry().catch(() => [])).filter((item) => item.repo.split("/").at(-1) !== BARBERIAS.repo && item.pagePath);
  if (!registry.length) return null;
  return (
    <details className="card px-4 py-3">
      <summary className="cursor-pointer text-[12px] font-medium text-muted">
        <BookOpen className="mr-1.5 inline size-3.5" />Aplicações documentadas <span className="ml-1 text-faint">· {registry.length}</span>
      </summary>
      <p className="mt-3 text-[12px] text-muted">Fichas dos aplicativos no vault.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {registry.map((item) => (
          <Link key={item.repo} href={`/vault?p=${encodeURIComponent(item.pagePath!)}`} className="flex min-w-0 items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-[12.5px] transition hover:border-border-strong">
            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{item.page?.replace(/^Página\s*-\s*/, "") ?? item.repo}</span><span className="mt-0.5 block truncate text-[11px] text-faint">{item.repo}</span></span>
            <ArrowUpRight className="size-3.5 shrink-0 text-faint" />
          </Link>
        ))}
      </div>
    </details>
  );
}

function PortfolioLoading() {
  return (
    <div role="status" aria-label="Consultando apps, funil e e-mails no CRM" className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <div key={i} className="card h-[104px] p-4"><div className="loading-shimmer h-3 w-1/2 rounded" /><div className="loading-shimmer mt-4 h-6 w-1/3 rounded" /></div>)}</div>
      <div className="grid gap-3 lg:grid-cols-2">{Array.from({ length: 2 }, (_, i) => <div key={i} className="card h-[300px] p-4"><div className="loading-shimmer h-3 w-1/3 rounded" /><div className="loading-shimmer mt-6 h-[200px] rounded-xl" /></div>)}</div>
    </div>
  );
}
