"use client";

import { CalendarDays, ListChecks } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { quickAddTask, updateTask } from "@/app/actions/core";
import { Chip } from "@/components/ui/misc";
import type { TaskScope, TaskStatus } from "@/db/schema";
import { relativeDay, today } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { taskHref } from "@/lib/task-scope";
import type { TaskRow } from "@/server/tasks";
import { AssigneeBadge } from "./assignee-badge";
import { PriorityIcon } from "./priority-icon";

const COLUMNS: { id: TaskStatus; label: string; dot: string }[] = [
  { id: "todo", label: "A fazer", dot: "var(--faint)" },
  { id: "doing", label: "Em andamento", dot: "var(--warning)" },
  { id: "done", label: "Concluído", dot: "var(--success)" },
];

export function Kanban({ tasks, projectId, scope }: { tasks: TaskRow[]; projectId?: string; scope: TaskScope }) {
  const router = useRouter();
  const [items, moveOptimistically] = React.useOptimistic(tasks, (state, change: { id: string; status: TaskStatus }) => state.map((task) => task.id === change.id ? { ...task, status: change.status } : task));
  const [over, setOver] = React.useState<TaskStatus | null>(null);
  const [adding, setAdding] = React.useState<Record<string, string>>({});
  const [, start] = React.useTransition();
  const t = today();

  const move = (id: string, status: TaskStatus) => {
    start(async () => {
      moveOptimistically({ id, status });
      try { await updateTask(id, { status }); }
      catch { toast.error("Não foi possível mover a tarefa."); }
    });
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const list = items.filter((x) => x.status === col.id);
        return (
          <div
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.id);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = e.dataTransfer.getData("text/plain");
              if (items.some((item) => item.id === id)) move(id, col.id);
            }}
            className={cn("flex min-h-[300px] flex-col rounded-2xl border border-border bg-surface/60 p-2 transition", over === col.id && "border-accent/60 bg-accent/5")}
          >
            <div className="flex items-center gap-2 px-2 pb-2 pt-1 text-[13px] font-semibold">
              <span className="size-2 rounded-full" style={{ background: col.dot }} /> {col.label}
              <span className="font-normal text-faint">{list.length}</span>
            </div>
            <div className="flex-1 space-y-2">
              {list.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
                  onClick={() => router.push(taskHref(scope, task.id))}
                  className="cursor-grab rounded-xl border border-border bg-surface p-3 shadow-sm transition hover:border-border-strong active:cursor-grabbing"
                >
                  <div className={cn("text-[13.5px]", task.status === "done" && "text-faint line-through")}>{task.title}</div>
                  {task.assignee && <AssigneeBadge task={task} className="mt-1.5" />}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {task.project && <Chip color={task.project.color}>{task.project.name}</Chip>}
                    {task.dueDate && (
                      <span className={cn("flex items-center gap-1 text-[11.5px]", task.status !== "done" && task.dueDate < t ? "text-danger" : "text-muted")}>
                        <CalendarDays className="size-3" /> {relativeDay(task.dueDate)}
                      </span>
                    )}
                    {task.subtasks.total > 0 && <span className="flex items-center gap-1 text-[11.5px] text-faint"><ListChecks className="size-3" />{task.subtasks.done}/{task.subtasks.total}</span>}
                    <PriorityIcon level={task.priority} className="ml-auto" />
                  </div>
                  <div className="mt-2 flex gap-1 md:hidden">
                    {COLUMNS.filter((c) => c.id !== task.status).map((c) => (
                      <button key={c.id} onClick={(e) => { e.stopPropagation(); move(task.id, c.id); }} className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] text-muted">→ {c.label}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {col.id !== "done" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = adding[col.id]?.trim();
                  if (!v) return;
                  setAdding((a) => ({ ...a, [col.id]: "" }));
                  start(async () => {
                    try {
                      const { id } = await quickAddTask(v, projectId ?? null, scope);
                      if (col.id === "doing") await updateTask(id, { status: "doing" });
                    } catch { setAdding((a) => ({ ...a, [col.id]: v })); toast.error("Não foi possível criar a tarefa."); }
                  });
                }}
              >
                <input value={adding[col.id] ?? ""} onChange={(e) => setAdding((a) => ({ ...a, [col.id]: e.target.value }))} placeholder="+ Adicionar" className="mt-2 h-9 w-full rounded-lg bg-transparent px-2 text-[13px] outline-none placeholder:text-faint focus:bg-surface-2" />
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}
