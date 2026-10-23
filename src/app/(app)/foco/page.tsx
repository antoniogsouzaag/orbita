import { Timer } from "lucide-react";
import { FocusTimer } from "@/components/life/focus-timer";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { focusStats } from "@/server/life";
import { getSettings } from "@/server/settings";
import { listTasks } from "@/server/tasks";

export const metadata = { title: "Foco" };

const fmt = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}min` : ""}`);

export default async function Page({ searchParams }: { searchParams: Promise<{ tarefa?: string }> }) {
  const { tarefa } = await searchParams;
  const [stats, tasks, settings] = await Promise.all([focusStats(), listTasks({ view: "todas", limit: 60 }), getSettings()]);
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <PageHeader icon={<Timer />} title="Foco" description="Pomodoro com registro automático do tempo focado." />
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <FocusTimer initialTaskId={tasks.some((task) => task.id === tarefa) ? tarefa : undefined} tasks={tasks.map((t) => ({ id: t.id, title: t.title }))} defaultMinutes={settings.focusMinutes} />
        <div className="space-y-4">
          <Card className="grid grid-cols-2 gap-3 p-4">
            <div><div className="text-xl font-bold tabular-nums">{fmt(stats.today)}</div><div className="text-[12px] text-muted">hoje</div></div>
            <div><div className="text-xl font-bold tabular-nums">{fmt(stats.week)}</div><div className="text-[12px] text-muted">semana</div></div>
            <div><div className="text-xl font-bold tabular-nums">{fmt(stats.avgDaily)}</div><div className="text-[12px] text-muted">média/dia (30d)</div></div>
            <div><div className="text-xl font-bold tabular-nums">{stats.sessions}</div><div className="text-[12px] text-muted">sessões na semana</div></div>
          </Card>
          <Card>
            <CardHeader title="Sessões recentes" />
            <div className="space-y-1 px-5 pb-5">
              {stats.recent.length === 0 && <p className="text-[13px] text-muted">Nenhuma sessão ainda.</p>}
              {stats.recent.map((s) => (
                <div key={s.id} className="flex justify-between gap-2 text-[12.5px]"><span className="truncate text-muted">{s.label ?? "Foco livre"}</span><span className="shrink-0 tabular-nums">{s.minutes} min · {s.startedAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span></div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
