import { AgentsWidget, CrmWidget, DomainsWidget, GithubWidget, IncidentsWidget, OperationWidget, ProjectsWidget, WaitingWidget } from "@/components/empresa/widgets";
import { Capture } from "@/components/home/capture";
import { Customize } from "@/components/home/customize";
import { Hero } from "@/components/home/hero";
import { AgendaWidget, GoalsWidget, TasksWidget } from "@/components/home/widgets";
import { SectionLabel } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { loadEmpresa } from "@/server/empresa";
import { EMPRESA_WIDGETS, type EmpresaWidgetId } from "@/server/settings";

export const metadata = { title: "Empresa" };

const SPAN: Partial<Record<EmpresaWidgetId, string>> = { aguardando: "md:col-span-2", crm: "md:col-span-2 xl:col-span-1" };

export default async function Page() {
  const data = await loadEmpresa();
  const { settings } = data;

  const render: Record<EmpresaWidgetId, () => React.ReactNode> = {
    aguardando: () => <WaitingWidget asks={data.asks} due={data.due} crmMine={data.crmMine} crmTasksUrl={data.crmTasksUrl} today={data.today} />,
    operacao: () => <OperationWidget ops={data.ops} />,
    tarefas: () => <TasksWidget tasks={data.tasks} counts={data.counts} href="/tarefas?escopo=empresa" showScope={false} />,
    crm: () => <CrmWidget crm={data.crm} />,
    github: () => <GithubWidget gh={data.gh} />,
    agentes: () => <AgentsWidget activity={data.activity} />,
    projetos: () => <ProjectsWidget projects={data.projects} />,
    incidentes: () => <IncidentsWidget incidents={data.incidents} />,
    dominios: () => <DomainsWidget domains={data.domains} />,
    metas: () => <GoalsWidget goals={data.goals} />,
    agenda: () => <AgendaWidget agenda={data.agenda} />,
  };

  const visible = settings.empresaWidgets.order.filter((id) => !settings.empresaWidgets.hidden.includes(id) && render[id]);

  return (
    <>
      <Hero cover={settings.empresaCover} field="empresaCover" eyebrow="AG LABS" title={data.title} subtitle={data.subtitle.text} tone={data.subtitle.tone} />
      <Capture scope="empresa" projects={data.projects.map((p) => ({ id: p.id, name: p.name, color: p.color }))} aiEnabled={data.aiEnabled} />
      <div className="mx-auto mt-12 max-w-6xl px-4 sm:px-6">
        <div className="mb-4 flex items-center">
          <SectionLabel>Empresa hoje</SectionLabel>
          <div className="ml-auto">
            <Customize field="empresaWidgets" title="Personalizar a Empresa" order={settings.empresaWidgets.order} hidden={settings.empresaWidgets.hidden} labels={Object.fromEntries(EMPRESA_WIDGETS.map((w) => [w.id, w.label]))} />
          </div>
        </div>
        <div className="grid grid-flow-row-dense grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
