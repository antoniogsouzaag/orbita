import { Priorities } from "@/components/home/priorities";
import { personalPriorities, jevConfigured } from "@/server/decisions";
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
import { Suspense } from "react";
import { after } from "next/server";
import { syncStaleCalendars } from "@/server/calendar";
import { commitStreak } from "@/server/github";
import type { HomeData } from "@/server/home";

const SPAN: Partial<Record<WidgetId, string>> = { conquistas: "md:col-span-2", prioridades: "md:col-span-2", plano: "md:col-span-2", metas: "md:col-span-2 xl:col-span-1" };

export default async function HomePage() {
  after(() => syncStaleCalendars(60).then(() => undefined).catch(() => {}));
  const [data, projects] = await Promise.all([loadHome(), listProjects()]);
  const { settings } = data;

  const render: Record<WidgetId, () => React.ReactNode> = {
    prioridades: () => <Suspense fallback={<div className="p-5 text-xs text-muted">Organizando próximas ações…</div>}><PrioritySection /></Suspense>,
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
      <Suspense fallback={<Hero cover={settings.cover} title={data.title} subtitle={data.subtitle.text} tone={data.subtitle.tone} />}><PersonalHero data={data} /></Suspense>
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

async function PersonalHero({ data }: { data: HomeData }) {
  const commits = data.counts.open === 0 && data.subtitle.text === "0 tarefas abertas" ? await commitStreak() : null;
  return <Hero cover={data.settings.cover} title={data.title} subtitle={commits && commits > 1 ? `🔥 ${commits} dias seguidos de contribuições no GitHub` : data.subtitle.text} tone={data.subtitle.tone} />;
}

async function PrioritySection() { return <Priorities tasks={await personalPriorities()} jev={jevConfigured()} />; }
