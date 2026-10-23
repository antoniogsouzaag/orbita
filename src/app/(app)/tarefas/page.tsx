import { Suspense } from "react";
import { crmOverview, crmUrl } from "@/server/crm";
import { Briefcase, CheckSquare, User } from "lucide-react";
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
  const scopeParam = sp.escopo === "empresa" || sp.escopo === "todas" ? sp.escopo : "pessoal";
  const scope = scopeParam === "todas" ? undefined : scopeParam;
  const [tasks, projects, tags, counts, detail, hoje, prox, sem] = await Promise.all([
    listTasks({ view, projectId: sp.project, tag: sp.tag, scope }),
    listProjects(),
    allTags(),
    taskCounts(scope),
    sp.task ? getTask(sp.task) : Promise.resolve(null),
    listTasks({ view: "hoje", scope }),
    listTasks({ view: "proximos", scope }),
    listTasks({ view: "semdata", scope }),
  ]);
  const title = scopeParam === "empresa" ? "Tarefas da empresa" : scopeParam === "pessoal" ? "Tarefas pessoais" : "Todas as tarefas";
  const icon = scopeParam === "empresa" ? <Briefcase /> : scopeParam === "pessoal" ? <User /> : <CheckSquare />;
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader icon={icon} title={title} description={`${counts.open} abertas · ${counts.today} para hoje · ${counts.overdue} atrasadas`} actions={<NewTaskButton scope={scope ?? "pessoal"} />} />
      {scopeParam !== "pessoal" && <Suspense fallback={<p className="mb-4 text-xs text-muted">Consultando tarefas comerciais…</p>}><CommercialTasks /></Suspense>}
      <TasksView
        scope={scopeParam}
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

async function CommercialTasks() {
  const crm = await crmOverview();
  if (!crm.configured) return null;
  return <section className="mb-6 rounded-2xl border border-border bg-surface p-4">
    <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">Comercial · CRM</h2><a href={crmUrl("/tasks") ?? "#"} target="_blank" rel="noopener noreferrer" className="text-xs text-accent">Gerenciar no CRM ↗</a></div>
    <p className="mt-2 text-xs text-muted">Tarefas ligadas a contatos permanecem no CRM. As tarefas abaixo deste painel são a operação interna da empresa, sem duplicar registros.</p>
    {!crm.ok ? <p className="mt-3 text-xs text-warning">Não foi possível consultar o CRM agora.</p> : <><p className="mt-3 text-xs text-faint">{crm.summary.tarefas.pendentes} pendentes no CRM · amostra de até 8 tarefas de Antonio</p><ul className="mt-2 divide-y divide-border">{crm.mine.map((task) => <li key={task.id} className="flex flex-wrap justify-between gap-2 py-2 text-xs"><a href={crmUrl("/tasks") ?? "#"} target="_blank" rel="noopener noreferrer" className="hover:text-accent">{task.titulo}{task.contato?.nome ? ` · ${task.contato.nome}` : ""}</a><span className={task.vencida ? "text-warning" : "text-faint"}>{task.prazo ?? "Sem prazo"} · CRM</span></li>)}</ul>{!crm.mine.length && <p className="mt-2 text-xs text-muted">Nenhuma tarefa de Antonio retornada nesta consulta.</p>}</>}
  </section>;
}
