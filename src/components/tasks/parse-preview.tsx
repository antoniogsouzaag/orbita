"use client";

import { CalendarDays, Clock, Flag, FolderKanban, Hash } from "lucide-react";
import { relativeDay, today } from "@/lib/dates";
import { matchProject, parseTaskInput } from "@/lib/parse-task";
import { PRIORITY_LABEL } from "@/lib/utils";

/** Mostra, enquanto digita, o que a captura rápida entendeu. */
export function ParsePreview({ value, projects }: { value: string; projects: { id: string; name: string; color: string }[] }) {
  if (!value.trim()) return null;
  const p = parseTaskInput(value, today());
  const project = matchProject(p.projectQuery, projects);
  const chips: React.ReactNode[] = [];
  if (p.dueDate) chips.push(<Chip key="d" icon={<CalendarDays />}>{relativeDay(p.dueDate)}</Chip>);
  if (p.dueTime) chips.push(<Chip key="t" icon={<Clock />}>{p.dueTime}</Chip>);
  if (p.priority) chips.push(<Chip key="p" icon={<Flag />} tone={p.priority === 3 ? "text-danger" : p.priority === 2 ? "text-warning" : undefined}>{PRIORITY_LABEL[p.priority]}</Chip>);
  if (project) chips.push(<Chip key="pr" icon={<FolderKanban />}><span style={{ color: project.color }}>{project.name}</span></Chip>);
  for (const t of p.tags) chips.push(<Chip key={`#${t}`} icon={<Hash />}>{t}</Chip>);
  if (!chips.length) return null;
  return <div className="flex flex-wrap gap-1.5">{chips}</div>;
}

function Chip({ icon, children, tone }: { icon: React.ReactNode; children: React.ReactNode; tone?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[11.5px] text-muted [&_svg]:size-3 ${tone ?? ""}`}>
      {icon}
      {children}
    </span>
  );
}
