import { Suspense } from "react";
import Link from "next/link";
import { Kanban } from "@/components/tasks/kanban";
import { CommercialTaskList } from "@/components/tasks/commercial-task-list";
import { Briefcase, User } from "lucide-react";
import { NewTaskButton } from "@/components/tasks/task-detail";
import { TasksView } from "@/components/tasks/tasks-view";
import { PageHeader } from "@/components/ui/card";
import { taskScope } from "@/lib/task-scope";
import { listProjects } from "@/server/projects";
import { assigneeOptions } from "@/server/task-claim";
import { allTags, getTask, listTasks, taskCounts, type TaskView } from "@/server/tasks";

export const metadata = { title: "Tarefas" };

const VALID: TaskView[] = ["hoje", "proximos", "atrasadas", "semdata", "andamento", "todas", "concluidas"];

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const view = (VALID.includes(sp.view as TaskView) ? sp.view : "todas") as TaskView;
  const scope = taskScope(sp.escopo);
  const kanban = sp.modo === "kanban";
  const [tasks, projects, tags, counts, detail, hoje, prox, sem, assignees] = await Promise.all([
    listTasks({ view, projectId: sp.project, tag: sp.tag, scope }),
    listProjects(false, scope),
    allTags(scope),
    taskCounts(scope),
    sp.task ? getTask(sp.task, scope) : Promise.resolve(null),
    listTasks({ view: "hoje", scope }),
    listTasks({ view: "proximos", scope }),
    listTasks({ view: "semdata", scope }),
    assigneeOptions(),
  ]);
  const title = scope === "empresa" ? "Tarefas da empresa" : "Tarefas pessoais";
  const icon = scope === "empresa" ? <Briefcase /> : <User />;
  const projectId = projects.some((p) => p.id === sp.project) ? sp.project : undefined;
  const done = kanban && view === "todas" ? await listTasks({ view: "concluidas", projectId, tag: sp.tag, scope, limit: 30 }) : [];
  const modeHref = (mode: string, project: string | null | undefined = sp.project) => {
    const query = new URLSearchParams(Object.entries(sp).filter((entry): entry is [string, string] => entry[1] !== undefined));
    query.set("modo", mode);
    if (project) query.set("project", project); else query.delete("project");
    return `/tarefas?${query}`;
  };
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader icon={icon} title={title} description={`${counts.open} ${scope === "empresa" ? "internas abertas" : "abertas"} · ${counts.doing} em andamento · ${counts.today} para hoje · ${counts.overdue} atrasadas`} actions={<><nav aria-label="Visualização das tarefas" className="flex rounded-lg border border-border p-1 text-xs">{["lista", "kanban"].map(mode => <Link key={mode} href={modeHref(mode)} aria-current={(kanban ? "kanban" : "lista") === mode ? "page" : undefined} className={`rounded-md px-3 py-1.5 ${(kanban ? "kanban" : "lista") === mode ? "bg-accent/15 text-accent" : "text-muted"}`}>{mode === "lista" ? "Lista" : "Kanban"}</Link>)}</nav><NewTaskButton scope={scope} projectId={projectId} /></>} />
      {kanban && <nav aria-label="Projetos no Kanban" className="mb-4 flex flex-wrap gap-2 text-xs"><Link className={!projectId ? "font-medium text-accent" : "text-muted"} href={modeHref("kanban", null)}>Todos os projetos</Link>{projects.map(project => <Link key={project.id} className={projectId === project.id ? "font-medium text-accent" : "text-muted"} href={modeHref("kanban", project.id)}>{project.name}</Link>)}</nav>}
      {kanban ? <Kanban key={`${scope}:${sp.project ?? "all"}:${view}:${sp.tag ?? ""}`} tasks={[...tasks, ...done]} projectId={projectId} scope={scope} /> : <TasksView
        scope={scope}
        tasks={tasks}
        view={view}
        counts={{ hoje: hoje.length, proximos: prox.length, atrasadas: counts.overdue, semdata: sem.length, andamento: counts.doing, todas: counts.open }}
        assignees={assignees}
        projects={projects.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
        tags={tags}
        activeTag={sp.tag}
        projectId={projectId}
        detail={detail}
      />}
      {scope === "empresa" && !sp.project && <Suspense fallback={<p className="mt-4 text-xs text-muted">Consultando tarefas comerciais…</p>}><CommercialTaskList view={view} product={sp.tag} /></Suspense>}
    </div>
  );
}
