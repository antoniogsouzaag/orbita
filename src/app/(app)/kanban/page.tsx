import { KanbanSquare } from "lucide-react";
import Link from "next/link";
import { Kanban } from "@/components/tasks/kanban";
import { PageHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { taskScope } from "@/lib/task-scope";
import { listProjects } from "@/server/projects";
import { listTasks } from "@/server/tasks";

export const metadata = { title: "Kanban" };

export default async function KanbanPage({ searchParams }: { searchParams: Promise<{ project?: string; escopo?: string }> }) {
  const sp = await searchParams;
  const scope = taskScope(sp.escopo);
  const projects = await listProjects(false, scope);
  const project = projects.some((p) => p.id === sp.project) ? sp.project : undefined;
  const [open, done] = await Promise.all([listTasks({ view: "todas", projectId: project, scope }), listTasks({ view: "concluidas", projectId: project, limit: 30, scope })]);
  const href = (id?: string) => `/kanban?escopo=${scope}${id ? `&project=${id}` : ""}`;
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <PageHeader icon={<KanbanSquare />} title={scope === "empresa" ? "Kanban da empresa" : "Kanban pessoal"} description="Arraste os cartões entre as colunas." />
      <nav aria-label="Espaço do Kanban" className="mb-4 flex gap-2 text-sm"><Link href="/kanban" className={scope === "pessoal" ? "font-medium text-accent" : "text-muted"}>Pessoal</Link><span className="text-faint">/</span><Link href="/kanban?escopo=empresa" className={scope === "empresa" ? "font-medium text-accent" : "text-muted"}>Empresa</Link></nav>
      <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">
        <Link href={href()} className={cn("shrink-0 rounded-full px-3 py-1 text-[12.5px]", !project ? "bg-fg text-bg" : "bg-surface-2 text-muted hover:text-fg")}>Todos os projetos</Link>
        {projects.map((p) => (
          <Link key={p.id} href={href(p.id)} className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px]", project === p.id ? "bg-fg text-bg" : "bg-surface-2 text-muted hover:text-fg")}>
            <span className="size-1.5 rounded-full" style={{ background: p.color }} />{p.name}
          </Link>
        ))}
      </div>
      <Kanban key={`${scope}:${project ?? "all"}`} tasks={[...open, ...done]} projectId={project} scope={scope} />
    </div>
  );
}
