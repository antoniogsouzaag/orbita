"use client";

import { CheckSquare, Hash, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { quickAddTask, toggleTask } from "@/app/actions/core";
import { Card, EmptyState } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { relativeDay, today } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { TaskRow, TaskView } from "@/server/tasks";
import type { TaskScope } from "@/db/schema";
import { ParsePreview } from "./parse-preview";
import { TaskDetail, type TaskDetailData } from "./task-detail";
import { TaskItem } from "./task-item";

const VIEWS: { id: TaskView; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "proximos", label: "Próximos" },
  { id: "atrasadas", label: "Atrasadas" },
  { id: "semdata", label: "Sem data" },
  { id: "todas", label: "Todas" },
  { id: "concluidas", label: "Concluídas" },
];

function groupByDate(tasks: TaskRow[], view: TaskView) {
  if (view === "concluidas" || view === "semdata") return [{ key: "all", label: "", items: tasks }];
  const t = today();
  const groups = new Map<string, { key: string; label: string; items: TaskRow[] }>();
  for (const task of tasks) {
    let key = task.dueDate ?? "zz-sem-data";
    let label = task.dueDate ? relativeDay(task.dueDate) : "Sem data";
    if (task.dueDate && task.dueDate < t) {
      key = "0-atrasadas";
      label = "Atrasadas";
    }
    if (!groups.has(key)) groups.set(key, { key, label, items: [] });
    groups.get(key)!.items.push(task);
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function TasksView({
  tasks,
  view,
  counts,
  projects,
  tags,
  activeTag,
  projectId,
  detail,
  hideViews,
  scope,
}: {
  tasks: TaskRow[];
  view: TaskView;
  counts?: Partial<Record<TaskView, number>>;
  projects: { id: string; name: string; color: string }[];
  tags?: string[];
  activeTag?: string;
  projectId?: string;
  detail: TaskDetailData | null;
  hideViews?: boolean;
  scope?: TaskScope;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = React.useState("");
  const [optimistic, toggle] = React.useOptimistic(tasks, (state, id: string) => state.map((t) => (t.id === id ? { ...t, status: t.status === "done" ? "todo" : "done" } : t)) as TaskRow[]);
  const [pending, start] = React.useTransition();

  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) p.delete(k); else p.set(k, v);
    }
    const s = p.toString();
    return `${pathname}${s ? `?${s}` : ""}`;
  };

  const groups = groupByDate(optimistic, view);

  return (
    <div className={cn("grid min-w-0 grid-cols-1 gap-6", !hideViews && "lg:grid-cols-[200px_minmax(0,1fr)]")}>
      {!hideViews && (
        <aside className="min-w-0 space-y-5">
          {scope && (
            <div className="grid grid-cols-2 gap-0.5 rounded-xl border border-border bg-surface-2 p-0.5 text-[12.5px]">
              {(["pessoal", "empresa"] as const).map((s) => (
                <Link key={s} href={href({ escopo: s === "pessoal" ? null : s, task: null, project: null, tag: null })} className={cn("rounded-[10px] px-2 py-1.5 text-center capitalize transition", scope === s ? "bg-surface font-medium text-fg shadow-sm" : "text-muted hover:text-fg")}>
                  {s}
                </Link>
              ))}
            </div>
          )}
          <nav className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col">
            {VIEWS.map((v) => (
              <Link
                key={v.id}
                href={href({ view: v.id, task: null })}
                className={cn("flex shrink-0 items-center justify-between gap-3 rounded-xl px-3 py-2 text-[13.5px] transition", view === v.id ? "bg-surface-3 font-medium text-fg" : "text-muted hover:bg-surface-2 hover:text-fg")}
              >
                {v.label}
                {counts?.[v.id] !== undefined && counts[v.id]! > 0 && <span className={cn("text-[12px] tabular-nums", v.id === "atrasadas" ? "text-danger" : "text-faint")}>{counts[v.id]}</span>}
              </Link>
            ))}
          </nav>
          {projects.length > 0 && (
            <div className="hidden lg:block">
              <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-faint">Projetos</div>
              {projects.map((p) => (
                <Link key={p.id} href={href({ project: projectId === p.id ? null : p.id, task: null })} className={cn("flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px]", projectId === p.id ? "bg-surface-3 text-fg" : "text-muted hover:text-fg")}>
                  <span className="size-2 rounded-full" style={{ background: p.color }} /> <span className="truncate">{p.name}</span>
                </Link>
              ))}
            </div>
          )}
          {tags && tags.length > 0 && (
            <div className="hidden lg:block">
              <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-faint">Tags</div>
              <div className="flex flex-wrap gap-1 px-2">
                {tags.map((t) => (
                  <Link key={t} href={href({ tag: activeTag === t ? null : t, task: null })} className={cn("flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[12px]", activeTag === t ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted hover:text-fg")}>
                    <Hash className="size-3" />{t}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      )}

      <div className="min-w-0 space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!value.trim()) return;
            const v = value;
            setValue("");
            start(async () => {
              try {
                await quickAddTask(view === "hoje" && !/\b(hoje|amanh|segunda|terça|terca|quarta|quinta|sexta|s[áa]bado|domingo|\d{1,2}\/\d{1,2})/i.test(v) ? `${v} hoje` : v, projectId ?? null, scope ?? "pessoal");
                toast.success("Tarefa criada");
              } catch { setValue(v); toast.error("Não foi possível criar a tarefa. Verifique o projeto e tente novamente."); }
            });
          }}
          className="card px-3 py-1.5 transition focus-within:border-accent/40"
        >
          <div className="flex items-center gap-2">
            <Plus className="ml-1 size-4 shrink-0 text-accent" />
            <Input value={value} onChange={(e) => setValue(e.target.value)} disabled={pending} placeholder={`Adicionar tarefa${view === "hoje" ? " para hoje" : ""}…  #tag !alta amanhã 15h @projeto`} className="h-11 border-transparent bg-transparent px-1 text-[15px] focus:border-transparent focus:ring-0" />
          </div>
          {value && <div className="px-3 pb-1"><ParsePreview value={value} projects={projects} /></div>}
        </form>

        {optimistic.length === 0 ? (
          <Card><EmptyState icon={<CheckSquare />} title={view === "concluidas" ? "Nada concluído ainda" : "Nenhuma tarefa aqui"} description="Tudo limpo por enquanto. ✨" /></Card>
        ) : (
          <Card className="divide-y divide-border/70 overflow-hidden p-0">
          {groups.map((g) => (
            <section key={g.key} className="p-2">
              {g.label && (
                <div className={cn("flex items-center gap-2 px-3 pb-1.5 pt-2 text-[11.5px] font-semibold uppercase tracking-[0.12em]", g.key === "0-atrasadas" ? "text-danger" : "text-faint")}>
                  {g.label} <span className="rounded-full bg-surface-2 px-1.5 py-px text-[10.5px] font-medium tracking-normal text-muted">{g.items.length}</span>
                </div>
              )}
              {g.items.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  showDate={g.key === "all" || g.key === "0-atrasadas"}
                  showScope={false}
                  onOpen={() => router.push(href({ task: t.id }), { scroll: false })}
                  onToggle={() =>
                    start(async () => {
                      toggle(t.id);
                      await toggleTask(t.id);
                    })
                  }
                />
              ))}
            </section>
          ))}
          </Card>
        )}
      </div>

      {detail && <TaskDetail key={detail.id} task={detail} projects={projects} onClose={() => router.push(href({ task: null }), { scroll: false })} />}
    </div>
  );
}
