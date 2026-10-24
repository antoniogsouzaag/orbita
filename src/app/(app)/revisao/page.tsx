import { DailyCheckin } from "@/components/life/daily-checkin";
import { getCheckin } from "@/server/checkins";
import { today } from "@/lib/dates";
import { BarChart3 } from "lucide-react";
import { ReviewCharts } from "@/components/life/review-charts";
import { PageHeader } from "@/components/ui/card";
import { reviewData } from "@/server/review";

export const metadata = { title: "Revisão" };

export default async function Page() {
 const date = today();
 const [checkin, review] = await Promise.all([getCheckin(date), reviewData(60)]);
 return <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6"><PageHeader icon={<BarChart3 />} title="Revisão" description="Entenda seu ritmo, reconheça as entregas e ajuste o próximo passo." /><ReviewCharts data={review.series} notes={review.notes} /><details className="rounded-2xl border border-border bg-surface"><summary className="cursor-pointer px-5 py-4 text-sm font-medium">Bem-estar de hoje <span className="ml-2 text-xs text-muted">{checkin ? "Registrado · editar" : "Como você está?"}</span></summary><div className="max-w-xl p-3"><DailyCheckin key={date} date={date} checkin={checkin} /></div></details></div>;
}
