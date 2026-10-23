"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckSquare } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { AgendaEvent, AgendaTask } from "@/components/agenda/agenda-page";
import { arrangeTimeBlocks } from "@/lib/calendar";
import { cn } from "@/lib/utils";

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export function CalendarTimeGrid({ days, today, selected, byDay, tasksByDay, onSelect, onEvent, onCreate }: {
  days: string[]; today: string; selected: string; byDay: Map<string, AgendaEvent[]>; tasksByDay: Map<string, AgendaTask[]>;
  onSelect: (date: string) => void; onEvent: (event: AgendaEvent) => void; onCreate: (date: string) => void;
}) {
  const scroll = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { if (scroll.current) scroll.current.scrollTop = 7 * 48; }, []);
  return (
    <div ref={scroll} className="max-h-[660px] overflow-auto overscroll-contain">
      <div style={{ minWidth: days.length > 1 ? 780 : undefined }}>
        <div className="sticky top-0 z-20 grid border-b border-border bg-surface/95 backdrop-blur-xl" style={{ gridTemplateColumns: `44px repeat(${days.length}, minmax(0,1fr))` }}>
          <div className="grid place-items-center text-[9px] text-faint">Hora</div>
          {days.map((day) => (
            <div key={day} className="min-w-0 border-l border-border px-2 py-3">
              <div className="flex items-center gap-1">
                <button onClick={() => onSelect(day)} className={cn("flex items-center gap-2 rounded-lg px-1 text-xs", day === selected && "text-accent")}>
                  <span className="capitalize text-muted">{format(parseISO(day), "EEE", { locale: ptBR })}</span>
                  <span className={cn("grid size-7 place-items-center rounded-full font-semibold", day === today && "bg-accent text-accent-fg")}>{Number(day.slice(8))}</span>
                </button>
                <button onClick={() => onCreate(day)} aria-label={`Novo evento em ${format(parseISO(day), "dd/MM")}`} className="ml-auto rounded-lg px-2 text-lg text-faint hover:bg-surface-2 hover:text-fg">+</button>
              </div>
              <div className="mt-2 min-h-4 space-y-1">
                {(byDay.get(day) ?? []).filter((event) => event.allDay).map((event) => <button key={event.id} onClick={() => onEvent(event)} className="block w-full truncate rounded-md px-1.5 py-1 text-left text-[10px] font-medium" style={{ background: `color-mix(in oklab, ${event.color} 15%, transparent)`, color: event.color }}>{event.title}</button>)}
                {(tasksByDay.get(day) ?? []).filter((task) => !task.time).map((task) => <Link key={task.id} href={`/tarefas?task=${task.id}`} className="flex items-center gap-1 text-[10px] text-muted"><CheckSquare className="size-3 shrink-0" /><span className={cn("truncate", task.done && "line-through")}>{task.title}</span></Link>)}
              </div>
            </div>
          ))}
        </div>
        <div className="grid" style={{ gridTemplateColumns: `44px repeat(${days.length}, minmax(0,1fr))` }}>
          <div className="relative h-[1152px] bg-surface-2/20">{Array.from({ length: 24 }, (_, hour) => <span key={hour} className="absolute right-2 text-[10px] tabular-nums text-faint" style={{ top: hour * 48 + 4 }}>{String(hour).padStart(2, "0")}:00</span>)}</div>
          {days.map((day) => {
            const eventBlocks = (byDay.get(day) ?? []).filter((event) => !event.allDay).map((event) => ({ id: event.id, title: event.title, color: event.color, event, task: null as AgendaTask | null, startMinute: event.date < day ? 0 : minutes(event.start ?? "00:00"), endMinute: event.endDate > day ? 1440 : minutes(event.end ?? "23:59") }));
            const taskBlocks = (tasksByDay.get(day) ?? []).filter((task) => task.time).map((task) => ({ id: task.id, title: task.title, color: task.color, event: null as AgendaEvent | null, task, startMinute: minutes(task.time!), endMinute: Math.min(1440, minutes(task.time!) + 30) }));
            const blocks = arrangeTimeBlocks([...eventBlocks, ...taskBlocks].map((block) => ({ ...block, endMinute: Math.max(block.endMinute, block.startMinute + 30) })));
            return (
              <div key={day} className={cn("relative h-[1152px] min-w-0 border-l border-border", day === today && "bg-accent/3")} style={{ backgroundImage: "linear-gradient(to bottom, var(--border) 1px, transparent 1px)", backgroundSize: "100% 48px" }}>
                {blocks.map((block) => {
                  const className = cn("absolute overflow-hidden rounded-lg border-l-2 px-2 py-1 text-left text-[10px] transition hover:z-10 hover:brightness-125 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-accent", block.task?.done && "opacity-60");
                  const style: React.CSSProperties = { top: block.startMinute * .8, height: Math.max(28, (block.endMinute - block.startMinute) * .8 - 2), left: `calc(${block.lane * 100 / block.lanes}% + 3px)`, width: `calc(${100 / block.lanes}% - 6px)`, borderColor: block.color, background: `color-mix(in oklab, ${block.color} 18%, var(--surface))`, color: block.color };
                  const label = <><span className={cn("block font-semibold leading-tight", block.task?.done && "line-through")}>{block.task && "☐ "}{block.title}</span><span className="mt-0.5 block text-[9px] opacity-75">{block.event ? block.event.date < day ? "Continuação" : block.event.start : block.task?.time}</span></>;
                  return block.event ? <button key={block.id} onClick={() => onEvent(block.event!)} className={className} style={style} title={block.title}>{label}</button> : <Link key={block.id} href={`/tarefas?task=${block.id}`} className={className} style={style}>{label}</Link>;
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
