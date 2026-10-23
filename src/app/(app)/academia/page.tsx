import { Dumbbell } from "lucide-react";
import { WorkoutsPage } from "@/components/life/workouts-page";
import { PageHeader } from "@/components/ui/card";
import { listWorkouts, workoutStats } from "@/server/life";
import { listTrainingPlans } from "@/server/training";

export const metadata = { title: "Academia" };

export default async function Page() {
  const [workouts, plans, stats] = await Promise.all([listWorkouts(120), listTrainingPlans(), workoutStats()]);
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <PageHeader icon={<Dumbbell />} title="Academia" description="Treinos, exercícios e cargas." />
      <WorkoutsPage plans={plans} workouts={workouts} weekCount={stats.week} monthCount={stats.month} />
    </div>
  );
}
