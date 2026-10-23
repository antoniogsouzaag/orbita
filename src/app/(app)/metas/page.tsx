import { Goal } from "lucide-react";
import { GoalsPage } from "@/components/goals/goals-page";
import { PageHeader } from "@/components/ui/card";
import { listGoals } from "@/server/goals";

export const metadata = { title: "Metas" };

export default async function Page() {
  const goals = await listGoals();
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <PageHeader icon={<Goal />} title="Metas" description="O que você quer conquistar — com progresso mensurável." />
      <GoalsPage goals={goals} />
    </div>
  );
}
