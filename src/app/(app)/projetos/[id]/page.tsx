import { FolderKanban, KanbanSquare } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EditProjectButton } from "@/components/projects/projects-grid";
import { NewTaskButton } from "@/components/tasks/task-detail";
import { Kanban } from "@/components/tasks/kanban";
import { TasksView } from "@/components/tasks/tasks-view";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { AREA_LABEL } from "@/lib/utils";
import { getProject, listProjects } from "@/server/projects";
import { getTask, listTasks } from "@/server/tasks";

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ task?: string; modo?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const project = await getProject(id);
  if (!project) notFound();
  const [open, done, projects, detail] = await Promise.all([
    listTasks({ view: "todas", projectId: id }),
    listTasks({ view: "concluidas", projectId: id, limit: 50 }),
    listProjects(),
    sp.task ? getTask(sp.task) : Promise.resolve(null),
  ]);
  const kanban = sp.modo === "kanban";
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader
        icon={<FolderKanban style={{ color: project.color }} />}
        title={project.name}
        description={`${AREA_LABEL[project.area]} · ${open.length} abertas · ${done.length} concluídas${project.description ? ` — ${project.description}` : ""}`}
        actions={
          <>
            <Button size="sm" variant="ghost" asChild>
              <Link href={kanban ? `/projetos/${id}` : `/projetos/${id}?modo=kanban`}><KanbanSquare /> {kanban ? "Lista" : "Kanban"}</Link>
            </Button>
            <EditProjectButton project={project} />
            <NewTaskButton projectId={id} />
          </>
        }
      />
      {kanban ? (
        <Kanban tasks={[...open, ...done]} projectId={id} />
      ) : (
        <TasksView tasks={open} view="todas" projects={projects.map((p) => ({ id: p.id, name: p.name, color: p.color }))} projectId={id} detail={detail} hideViews />
      )}
    </div>
  );
}
