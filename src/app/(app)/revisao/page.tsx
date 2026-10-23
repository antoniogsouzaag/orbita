import { BarChart3 } from "lucide-react";
import { ReviewCharts } from "@/components/life/review-charts";
import { PageHeader } from "@/components/ui/card";
import { reviewData } from "@/server/review";

export const metadata = { title: "Revisão" };

export default async function Page() {
  // Load both 30-day windows once so changing the period stays instant.
  const review = await reviewData(60);
  return <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6"><PageHeader icon={<BarChart3 />} title="Revisão" description="Entenda seu ritmo, reconheça as entregas e ajuste o próximo passo." /><ReviewCharts data={review.series} notes={review.notes} /></div>;
}
