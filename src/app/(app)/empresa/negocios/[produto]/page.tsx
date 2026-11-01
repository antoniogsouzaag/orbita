import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Building2, CircleCheck, CircleDashed } from "lucide-react";
import { ProductAppMetrics } from "@/components/empresa/product-app-metrics";
import { ProductCommercial } from "@/components/empresa/product-commercial";
import { crmKeyForUnit } from "@/lib/business-crm";
import { Card, PageHeader } from "@/components/ui/card";
import { BUSINESS_UNITS, MODEL_INFO, businessUnit } from "@/lib/business-models";
import { listTasks } from "@/server/tasks";

export function generateStaticParams() {
  return BUSINESS_UNITS.filter((unit) => unit.id !== "barberias").map((unit) => ({ produto: unit.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ produto: string }> }) {
  const unit = businessUnit((await params).produto);
  return { title: unit ? `Negócios · ${unit.name}` : "Negócios" };
}

/** Visão de um negócio no seu próprio modelo: o que acompanhar, dados do app e próximas ações. */
export default async function Page({ params }: { params: Promise<{ produto: string }> }) {
  const unit = businessUnit((await params).produto);
  if (!unit) notFound();
  const model = MODEL_INFO[unit.model];
  const tasks = await listTasks({ scope: "empresa", tag: unit.tag, limit: 20, includeParts: true }).catch(() => null);
  return <div className="mx-auto max-w-6xl space-y-3 px-4 sm:px-6">
    <Link href="/empresa/negocios" className="inline-flex text-xs text-muted hover:text-fg">← Todos os negócios</Link>
    <PageHeader icon={<Building2 />} title={unit.name} description={unit.summary} actions={<a href={`https://${unit.domain}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent">{unit.domain}<ArrowUpRight className="size-3.5" /></a>} />
    <div className="grid gap-3 sm:grid-cols-3">
      {[["Modelo", model.label], ["Unidade de negócio", model.unit], ["Receita", model.revenue]].map(([label, value]) => <Card key={label} className="p-3"><p className="text-[11px] text-muted">{label}</p><p className="mt-1 text-[13.5px] font-medium">{value}</p></Card>)}
    </div>
    <Suspense fallback={<Card className="p-4 text-xs text-muted">Consultando dados administrativos do app…</Card>}><ProductAppMetrics product={unit.id} /></Suspense>
    <Suspense fallback={<Card className="p-4 text-xs text-muted" role="status">Consultando funil comercial e e-mails no CRM…</Card>}><ProductCommercial produto={crmKeyForUnit(unit.id)} /></Suspense>
    <div className="grid items-start gap-3 lg:grid-cols-2">
      <Card className="p-4">
        <h2 className="text-[14px] font-semibold tracking-tight">O que acompanhar neste modelo</h2>
        <ul className="mt-3 space-y-2">{unit.indicators.map((item) => <li key={item.label} className="flex items-start gap-2 text-[13px]">
          {item.available ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-label="Definido na coleta do app" /> : <CircleDashed className="mt-0.5 size-4 shrink-0 text-faint" aria-label="Ainda sem coleta definida" />}
          <span className={item.available ? "" : "text-muted"}>{item.label}<span className="ml-1.5 text-[11px] text-faint">{item.source === "crm" ? "CRM" : "app"}{item.available ? "" : " · lacuna"}</span></span>
        </li>)}</ul>
        <p className="mt-3 rounded-xl bg-surface-2 p-3 text-xs text-muted"><span className="font-medium text-fg">Próximo passo: </span>{unit.next}</p>
      </Card>
      <Card className="p-4">
        <h2 className="text-[14px] font-semibold tracking-tight">Próximas ações de {unit.name}</h2>
        <p className="mt-1 text-xs text-muted">Tarefas internas da Empresa com a tag {unit.tag}.</p>
        {tasks === null ? <p className="mt-3 text-sm text-warning">Não foi possível consultar as tarefas.</p> : !tasks.length ? <p className="mt-3 text-sm text-muted">Nenhuma ação aberta com este vínculo.</p> : <ul className="mt-3 divide-y divide-border">{tasks.map((task) => <li key={task.id}><Link href={`/tarefas?escopo=empresa&task=${task.parentId ?? task.id}`} className="block py-2 text-sm hover:text-accent">{task.title}{task.parentTitle && <span className="mt-0.5 block text-[11px] text-faint">parte de {task.parentTitle}</span>}{task.assignee && <span className="mt-1 block text-[11px] text-faint">{task.status === "doing" ? "Em andamento" : "Assumida"} · {task.assignee}</span>}</Link></li>)}</ul>}
      </Card>
    </div>
  </div>;
}
