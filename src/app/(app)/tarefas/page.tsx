import { Suspense } from "react";
import { CommercialTaskList } from "@/components/tasks/commercial-task-list";
import { Briefcase, User } from "lucide-react";
import { NewTaskButton } from "@/components/tasks/task-detail";
import { TasksView } from "@/components/tasks/tasks-view";
import { PageHeader } from "@/components/ui/card";
import { taskScope } from "@/lib/task-scope";
import { listProjects } from "@/server/projects";
import { allTags, getTask, listTasks, taskCounts, type TaskView } from "@/server/tasks";

export const metadata = { title: "Tarefas" };

const VALID: TaskView[] = ["hoje", "proximos", "atrasadas", "semdata", "todas", "concluidas"];

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const view = (VALID.includes(sp.view as TaskView) ? sp.view : "todas") as TaskView;
  const scope = taskScope(sp.escopo);
  const [tasks, projects, tags, counts, detail, hoje, prox, sem] = await Promise.all([
    listTasks({ view, projectId: sp.project, tag: sp.tag, scope }),
    listProjects(false, scope),
    allTags(scope),
    taskCounts(scope),
    sp.task ? getTask(sp.task, scope) : Promise.resolve(null),
    listTasks({ view: "hoje", scope }),
    listTasks({ view: "proximos", scope }),
    listTasks({ view: "semdata", scope }),
  ]);
  const title = scope === "empresa" ? "Tarefas da empresa" : "Tarefas pessoais";
  const icon = scope === "empresa" ? <Briefcase /> : <User />;
  const projectId = projects.some((p) => p.id === sp.project) ? sp.project : undefined;
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader icon={icon} title={title} description={`${counts.open} abertas · ${counts.today} para hoje · ${counts.overdue} atrasadas`} actions={<NewTaskButton scope={scope} projectId={projectId} />} />
      <TasksView
        scope={scope}
        tasks={tasks}
        view={view}
        counts={{ hoje: hoje.length, proximos: prox.length, atrasadas: counts.overdue, semdata: sem.length, todas: counts.open }}
        projects={projects.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
        tags={tags}
        activeTag={sp.tag}
        projectId={projectId}
        detail={detail}
      />
      {scope === "empresa" && <Suspense fallback={<p className="mt-4 text-xs text-muted">Consultando tarefas comerciais…</p>}><CommercialTaskList view={view} product={sp.tag} /></Suspense>}
    </div>
  );
}
