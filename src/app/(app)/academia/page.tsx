import { Dumbbell } from "lucide-react";
import { WorkoutsPage } from "@/components/life/workouts-page";
import { PageHeader } from "@/components/ui/card";
import { shiftDate, startOfWeekISO, today } from "@/lib/dates";
import { listWorkouts } from "@/server/life";

export const metadata = { title: "Academia" };

export default async function Page() {
  const workouts = await listWorkouts(120);
  const t = today();
  const week = startOfWeekISO(t);
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <PageHeader icon={<Dumbbell />} title="Academia" description="Treinos, exercícios e cargas." />
      <WorkoutsPage workouts={workouts} weekCount={workouts.filter((w) => w.date >= week).length} monthCount={workouts.filter((w) => w.date >= shiftDate(t, -29)).length} />
    </div>
  );
}
