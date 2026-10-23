import { Repeat } from "lucide-react";
import { HabitsPage } from "@/components/habits/habits-page";
import { PageHeader } from "@/components/ui/card";
import { listHabits } from "@/server/habits";

export const metadata = { title: "Hábitos" };

export default async function Page() {
  const habits = await listHabits({ days: 800 });
  const scheduled = habits.filter((h) => h.scheduledToday);
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader icon={<Repeat />} title="Hábitos" description={`${scheduled.filter((h) => h.doneToday).length} de ${scheduled.length} feitos hoje · clique nos quadradinhos para marcar dias passados`} />
      <HabitsPage habits={habits} />
    </div>
  );
}
