import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { ReviewCharts } from "@/components/life/review-charts";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { cn, formatBRL } from "@/lib/utils";
import { reviewData } from "@/server/review";

export const metadata = { title: "Revisão" };

function Delta({ now, prev, unit = "" }: { now: number | null; prev: number | null; unit?: string }) {
  if (now === null || prev === null || prev === 0) return null;
  const d = Math.round(((now - prev) / prev) * 100);
  if (!d) return null;
  return <span className={cn("flex items-center gap-0.5 text-[11.5px]", d > 0 ? "text-success" : "text-danger")}>{d > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{Math.abs(d)}%{unit}</span>;
}

export default async function Page() {
  const r = await reviewData(30);
  const w = r.week;
  const tiles = [
    { label: "Tarefas concluídas", value: String(w.tasks), delta: <Delta now={w.tasks} prev={w.tasksPrev} /> },
    { label: "Foco", value: `${Math.floor(w.focus / 60)}h${String(w.focus % 60).padStart(2, "0")}`, delta: <Delta now={w.focus} prev={w.focusPrev} /> },
    { label: "Hábitos cumpridos", value: w.habits === null ? "—" : `${w.habits}%`, delta: <Delta now={w.habits} prev={w.habitsPrev} /> },
    { label: "Humor / energia", value: `${w.mood ?? "—"} / ${w.energy ?? "—"}`, delta: null },
    { label: "Gastos", value: formatBRL(w.spend), delta: null },
  ];
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
      <PageHeader icon={<BarChart3 />} title="Revisão" description="Últimos 7 dias comparados com a semana anterior, e a tendência de 30 dias." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <div className="flex items-baseline justify-between gap-2"><div className="text-xl font-bold tabular-nums">{t.value}</div>{t.delta}</div>
            <div className="text-[12px] text-muted">{t.label}</div>
          </Card>
        ))}
      </div>
      <ReviewCharts data={r.series} />
      {r.notes.length > 0 && (
        <Card>
          <CardHeader title="Notas do check-in" />
          <div className="space-y-2 px-5 pb-5">
            {r.notes.map((n) => <div key={n.date} className="flex gap-3 text-[13px]"><span className="w-12 shrink-0 text-faint">{n.date.slice(8)}/{n.date.slice(5, 7)}</span><span className="text-muted">{n.note}</span></div>)}
          </div>
        </Card>
      )}
    </div>
  );
}
