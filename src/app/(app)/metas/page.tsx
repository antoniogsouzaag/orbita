import { Goal } from "lucide-react";
import { GoalsPage } from "@/components/goals/goals-page";
import { PageHeader } from "@/components/ui/card";
import { listGoals } from "@/server/goals";
import { projectScope, taskScope } from "@/lib/task-scope";

export const metadata = { title: "Metas" };

export default async function Page({ searchParams }: { searchParams: Promise<{ escopo?: string }> }) {
  const scope = taskScope((await searchParams).escopo);
  const goals = (await listGoals()).filter((goal) => projectScope(goal.area) === scope);
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <PageHeader icon={<Goal />} title={scope === "empresa" ? "Metas da empresa" : "Metas pessoais"} description="O que você quer conquistar — com progresso mensurável." />
      <GoalsPage key={scope} goals={goals} scope={scope} />
    </div>
  );
}
