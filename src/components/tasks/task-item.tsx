"use client";

import { CalendarDays, ListChecks } from "lucide-react";
import { Chip, CheckButton } from "@/components/ui/misc";
import { relativeDay, today } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { TaskRow } from "@/server/tasks";
import { PriorityIcon } from "./priority-icon";

export function TaskItem({ task, onToggle, onOpen, compact, showDate = true }: { task: TaskRow; onToggle: () => void; onOpen?: () => void; compact?: boolean; showDate?: boolean }) {
  const t = today();
  const done = task.status === "done";
  const overdue = !done && task.dueDate && task.dueDate < t;
  const isToday = task.dueDate === t;
  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen?.()}
      className={cn("group flex items-center gap-3 rounded-xl px-2 transition hover:bg-surface-2", compact ? "py-2" : "py-2.5", onOpen && "cursor-pointer")}
    >
      <CheckButton checked={done} onToggle={onToggle} label={done ? "Reabrir tarefa" : "Concluir tarefa"} />
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-[14px]", done && "text-faint line-through")}>{task.title}</div>
        {!compact && task.tags.length > 0 && <div className="mt-0.5 truncate text-[11.5px] text-faint">{task.tags.map((x) => `#${x}`).join(" ")}</div>}
      </div>
      {task.subtasks.total > 0 && (
        <span className="flex shrink-0 items-center gap-1 text-[12px] text-faint"><ListChecks className="size-3.5" />{task.subtasks.done}/{task.subtasks.total}</span>
      )}
      {task.project && <Chip color={task.project.color} className="hidden shrink-0 sm:inline-flex">{task.project.name}</Chip>}
      {showDate && task.dueDate && (
        <span className={cn("flex shrink-0 items-center gap-1 text-[12px]", overdue ? "text-danger" : isToday ? "text-warning" : "text-muted")}>
          <CalendarDays className="size-3.5" />
          {relativeDay(task.dueDate)}
          {task.dueTime && ` ${task.dueTime}`}
        </span>
      )}
      <PriorityIcon level={task.priority} className="shrink-0" />
    </div>
  );
}
