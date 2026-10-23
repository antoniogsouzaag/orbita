import { KanbanSquare } from "lucide-react";
import Link from "next/link";
import { Kanban } from "@/components/tasks/kanban";
import { PageHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { listProjects } from "@/server/projects";
import { listTasks } from "@/server/tasks";

export const metadata = { title: "Kanban" };

export default async function KanbanPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const [open, done, projects] = await Promise.all([listTasks({ view: "todas", projectId: project }), listTasks({ view: "concluidas", projectId: project, limit: 30 }), listProjects()]);
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <PageHeader icon={<KanbanSquare />} title="Kanban" description="Arraste os cartões entre as colunas." />
      <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">
        <Link href="/kanban" className={cn("shrink-0 rounded-full px-3 py-1 text-[12.5px]", !project ? "bg-fg text-bg" : "bg-surface-2 text-muted hover:text-fg")}>Todos</Link>
        {projects.map((p) => (
          <Link key={p.id} href={`/kanban?project=${p.id}`} className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px]", project === p.id ? "bg-fg text-bg" : "bg-surface-2 text-muted hover:text-fg")}>
            <span className="size-1.5 rounded-full" style={{ background: p.color }} />{p.name}
          </Link>
        ))}
      </div>
      <Kanban tasks={[...open, ...done]} projectId={project} />
    </div>
  );
}
