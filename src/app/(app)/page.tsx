import { Capture } from "@/components/home/capture";
import { Customize } from "@/components/home/customize";
import { Hero } from "@/components/home/hero";
import {
  AgendaWidget, CheckinWidget, FinanceWidget, FocusWidget, GoalsWidget, HabitsWidget, OpsWidget, PlanWidget, ReadingWidget, StreaksWidget, TasksWidget, WorkoutWidget,
} from "@/components/home/widgets";
import { SectionLabel } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { loadHome } from "@/server/home";
import { listProjects } from "@/server/projects";
import { WIDGETS, type WidgetId } from "@/server/settings";

const SPAN: Partial<Record<WidgetId, string>> = { conquistas: "md:col-span-2", plano: "md:col-span-2", metas: "md:col-span-2 xl:col-span-1" };

export default async function HomePage() {
  const [data, projects] = await Promise.all([loadHome(), listProjects()]);
  const { settings } = data;

  const render: Record<WidgetId, () => React.ReactNode> = {
    conquistas: () => <StreaksWidget cards={data.cards} />,
    habitos: () => <HabitsWidget habits={data.habits} done={data.habitsDone} total={data.habitsTotal} />,
    metas: () => <GoalsWidget goals={data.goals} />,
    tarefas: () => <TasksWidget tasks={data.tasks} counts={data.counts} />,
    agenda: () => <AgendaWidget agenda={data.agenda} />,
    plano: () => <PlanWidget plan={data.plan} aiEnabled={data.aiEnabled} />,
    checkin: () => <CheckinWidget checkin={data.checkin} />,
    operacao: () => <OpsWidget />,
    foco: () => <FocusWidget focus={data.focus} />,
    treino: () => <WorkoutWidget workout={data.lastWorkout} />,
    financas: () => <FinanceWidget finance={data.finance} />,
    leitura: () => <ReadingWidget books={data.books} />,
  };

  const visible = settings.widgets.order.filter((id) => !settings.widgets.hidden.includes(id) && render[id]);

  return (
    <>
      <Hero cover={settings.cover} title={data.title} subtitle={data.subtitle.text} tone={data.subtitle.tone} />
      <Capture projects={projects.map((p) => ({ id: p.id, name: p.name, color: p.color }))} aiEnabled={data.aiEnabled} />
      <div className="mx-auto mt-12 max-w-6xl px-4 sm:px-6">
        <div className="mb-4 flex items-center">
          <SectionLabel>Hoje</SectionLabel>
          <div className="ml-auto">
            <Customize order={settings.widgets.order} hidden={settings.widgets.hidden} labels={Object.fromEntries(WIDGETS.map((w) => [w.id, w.label]))} />
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
