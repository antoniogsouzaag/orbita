import Link from "next/link";
import { AgentsWidget, CrmWidget, DomainsWidget, GithubWidget, IncidentsWidget, OperationWidget, ProjectsWidget, WaitingWidget } from "@/components/empresa/widgets";
import { Capture } from "@/components/home/capture";
import { Customize } from "@/components/home/customize";
import { Hero } from "@/components/home/hero";
import { AgendaWidget, GoalsWidget, TasksWidget } from "@/components/home/widgets";
import { SectionLabel } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { cache, Suspense } from "react";
import { loadEmpresaLocal } from "@/server/empresa";
import { crmOverview } from "@/server/crm";
import { githubInbox } from "@/server/github-inbox";
import { EMPRESA_WIDGETS, type EmpresaWidgetId } from "@/server/settings";

export const metadata = { title: "Empresa" };

const SPAN: Partial<Record<EmpresaWidgetId, string>> = { aguardando: "md:col-span-2", crm: "md:col-span-2 xl:col-span-1" };
const getCrm = cache(() => crmOverview());
const getGithub = cache(() => githubInbox());

export default async function Page() {
  const data = await loadEmpresaLocal();
  const { settings } = data;

  const render: Record<EmpresaWidgetId, () => React.ReactNode> = {
    aguardando: () => <Suspense fallback={<WaitingWidget asks={data.asks} due={data.due} crmMine={data.crmMine} crmTasksUrl={data.crmTasksUrl} today={data.today} />}><WaitingCard data={data} /></Suspense>,
    operacao: () => <OperationWidget ops={data.ops} />,
    tarefas: () => <TasksWidget tasks={data.tasks} counts={data.counts} href="/tarefas?escopo=empresa" title="Operação interna · Órbita" showScope={false} />,
    crm: () => <Suspense fallback={<ProviderLoading title="Conectando ao CRM" />}><CrmCard /></Suspense>,
    github: () => <Suspense fallback={<ProviderLoading title="Atualizando PRs e propostas" />}><GithubCard /></Suspense>,
    agentes: () => <AgentsWidget activity={data.activity} />,
    projetos: () => <ProjectsWidget projects={data.projects} />,
    incidentes: () => <IncidentsWidget incidents={data.incidents} />,
    dominios: () => <DomainsWidget domains={data.domains} />,
    metas: () => <GoalsWidget goals={data.goals} href="/metas?escopo=empresa" />,
    agenda: () => <AgendaWidget agenda={data.agenda} />,
  };

  const visible = settings.empresaWidgets.order.filter((id) => !settings.empresaWidgets.hidden.includes(id) && render[id]);

  return (
    <>
      <Hero cover={settings.empresaCover} field="empresaCover" eyebrow="AG LABS" title={data.title} subtitle={data.subtitle.text} tone={data.subtitle.tone} />
      <Capture scope="empresa" projects={data.projects.map((p) => ({ id: p.id, name: p.name, color: p.color }))} aiEnabled={data.aiEnabled} />
      <div className="mx-auto mt-6 max-w-6xl px-4 sm:px-6">
        <Suspense fallback={null}><DecisionNotice /></Suspense>
        <div className="mb-4 flex items-center">
          <SectionLabel>Empresa hoje</SectionLabel>
          <div className="ml-auto">
            <Customize field="empresaWidgets" title="Personalizar a Empresa" order={settings.empresaWidgets.order} hidden={settings.empresaWidgets.hidden} labels={Object.fromEntries(EMPRESA_WIDGETS.map((w) => [w.id, w.label]))} />
          </div>
        </div>
        <div className="grid grid-flow-row-dense grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((id) => (
            <div key={id} className={cn("min-w-0", SPAN[id])}>
              {render[id]()}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ProviderLoading({ title }: { title: string }) {
  return <div role="status" className="card h-full min-h-48 space-y-4 p-5"><p className="text-sm font-medium">{title}</p><div className="loading-shimmer h-12 rounded-xl" /><div className="loading-shimmer h-3 w-2/3 rounded" /></div>;
}

async function CrmCard() { return <CrmWidget crm={await getCrm()} />; }
async function GithubCard() { return <GithubWidget gh={await getGithub()} />; }

async function WaitingCard({ data }: { data: Awaited<ReturnType<typeof loadEmpresaLocal>> }) {
  const [crm, github] = await Promise.all([getCrm(), getGithub()]);
  const mine = crm.configured && crm.ok ? crm.mine.filter((item) => item.prazo && item.prazo <= data.today) : [];
  return <WaitingWidget asks={data.asks} due={data.due} crmMine={mine} crmTasksUrl={data.crmTasksUrl} today={data.today} github={github} />;
}

async function DecisionNotice() {
  const gh = await getGithub();
  const count = gh.items.filter(item => item.kind === "proposta" && item.stage === "decision").length;
  if (!count) return gh.error ? <p role="status" className="mb-4 text-xs text-warning">Decisões do GitHub indisponíveis nesta consulta. <Link href="/github" className="underline">Conferir</Link></p> : null;
  return <Link href="/github?etapa=decision" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning/25 bg-warning/5 px-4 py-3 text-sm"><span><strong className="tabular-nums">{count}</strong> {count === 1 ? "decisão aguarda" : "decisões aguardam"} você{gh.truncated ? " · consulta parcial" : ""}{gh.stale ? " · última consulta disponível" : ""}</span><span className="text-xs text-muted">Revisar no GitHub ↗</span></Link>;
}
