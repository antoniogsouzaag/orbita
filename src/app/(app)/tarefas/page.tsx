import { CheckSquare } from "lucide-react";
import { NewTaskButton } from "@/components/tasks/task-detail";
import { TasksView } from "@/components/tasks/tasks-view";
import { PageHeader } from "@/components/ui/card";
import { listProjects } from "@/server/projects";
import { allTags, getTask, listTasks, taskCounts, type TaskView } from "@/server/tasks";

export const metadata = { title: "Tarefas" };

const VALID: TaskView[] = ["hoje", "proximos", "atrasadas", "semdata", "todas", "concluidas"];

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const view = (VALID.includes(sp.view as TaskView) ? sp.view : "todas") as TaskView;
  const [tasks, projects, tags, counts, detail, hoje, prox, sem] = await Promise.all([
    listTasks({ view, projectId: sp.project, tag: sp.tag }),
    listProjects(),
    allTags(),
    taskCounts(),
    sp.task ? getTask(sp.task) : Promise.resolve(null),
    listTasks({ view: "hoje" }),
    listTasks({ view: "proximos" }),
    listTasks({ view: "semdata" }),
  ]);
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader icon={<CheckSquare />} title="Tarefas" description={`${counts.open} abertas · ${counts.today} para hoje · ${counts.overdue} atrasadas`} actions={<NewTaskButton />} />
      <TasksView
        tasks={tasks}
        view={view}
        counts={{ hoje: hoje.length, proximos: prox.length, atrasadas: counts.overdue, semdata: sem.length, todas: counts.open }}
        projects={projects.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
        tags={tags}
        activeTag={sp.tag}
        projectId={sp.project}
        detail={detail}
      />
    </div>
  );
}
