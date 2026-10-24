import { DailyCheckin } from "@/components/life/daily-checkin";
import { getCheckin } from "@/server/checkins";
import { today } from "@/lib/dates";
import { BarChart3 } from "lucide-react";
import { ReviewCharts } from "@/components/life/review-charts";
import { PageHeader } from "@/components/ui/card";
import { reviewData } from "@/server/review";

export const metadata = { title: "Revisão" };

export default async function Page({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const { dia } = await searchParams;
  const current = today();
  const date = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) && dia <= current && !Number.isNaN(Date.parse(dia)) && new Date(`${dia}T12:00:00Z`).toISOString().slice(0, 10) === dia ? dia : current;
  const checkin = await getCheckin(date);
  // Load both 30-day windows once so changing the period stays instant.
  const review = await reviewData(60);
  return <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6"><PageHeader icon={<BarChart3 />} title="Revisão" description="Entenda seu ritmo, reconheça as entregas e ajuste o próximo passo." /><div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"><form className="space-y-3 rounded-xl border border-border p-5" action="/revisao"><label htmlFor="review-date" className="block text-sm font-medium">Diário de bem-estar</label><input id="review-date" type="date" name="dia" max={current} defaultValue={date} required className="w-full rounded-lg border border-border bg-surface p-2 text-sm" /><button className="rounded-lg bg-accent px-3 py-2 text-xs text-accent-fg">Abrir dia</button><p className="text-xs text-muted">Registre no fim do dia ou complete um dia anterior. Os dias sem resposta permanecem vazios.</p></form><DailyCheckin key={date} date={date} checkin={checkin} /></div><ReviewCharts data={review.series} notes={review.notes} /></div>;
}
