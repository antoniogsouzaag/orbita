"use client";

import { UserRoundCheck } from "lucide-react";
import { assigneeLabel, isStale, STALE_HOURS } from "@/lib/task-assignee";
import { cn } from "@/lib/utils";

/** Selo "Assumida por X" / "X · em andamento há 3 h". Destaca reservas sem mudança há mais de 48 h. */
export function AssigneeBadge({ task, className }: { task: { status: string; assignee: string | null; claimedAt: Date | string | null }; className?: string }) {
  const label = assigneeLabel(task);
  if (!label) return null;
  const stale = isStale(task);
  return (
    <span
      title={stale ? `Em andamento há mais de ${STALE_HOURS} h com o mesmo responsável — vale conferir se continua ativa.` : label}
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px]",
        stale ? "bg-warning/10 text-warning" : task.status === "doing" ? "bg-accent/10 text-accent" : "bg-surface-2 text-muted",
        className,
      )}
    >
      <UserRoundCheck className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}
