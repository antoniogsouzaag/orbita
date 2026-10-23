"use client";

import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, CheckSquare, ChevronLeft, ChevronRight, Clock3, Columns3, Copy, Link2, List, LoaderCircle, MapPin, Plus, RefreshCw, Search, Square, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { addIcsCalendar, deleteCalendar, deleteEvent, resyncCalendar, resyncCalendars, saveEvent, updateCalendar } from "@/app/actions/calendar";
import { CalendarTimeGrid } from "@/components/agenda/calendar-grid";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ColorPicker } from "@/components/ui/color";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import type { Calendar } from "@/db/schema";
import { eventFormSchema, type CalendarView } from "@/lib/calendar";
import { cn } from "@/lib/utils";

export type AgendaEvent = { id: string; title: string; date: string; endDate: string; lastDate: string; start: string | null; end: string | null; allDay: boolean; color: string; calendarName: string; editable: boolean; location: string | null; description: string | null };
export type AgendaTask = { id: string; title: string; date: string; time: string | null; done: boolean; color: string };

const WD = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const VIEWS = [{ value: "mes", label: "Mês", icon: CalendarDays }, { value: "semana", label: "Semana", icon: Columns3 }, { value: "dia", label: "Dia", icon: Square }, { value: "agenda", label: "Agenda", icon: List }] as const;
const iso = (date: Date) => format(date, "yyyy-MM-dd");
const longDate = (date: string) => format(parseISO(date), "EEEE, d 'de' MMMM", { locale: ptBR });
const timeLabel = (event: AgendaEvent) => event.allDay ? "Dia inteiro" : `${event.start} – ${event.end}${event.endDate > event.date ? ` · até ${format(parseISO(event.endDate), "dd/MM")}` : ""}`;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Não foi possível concluir. Tente novamente.";

export function AgendaPage({ month, today, initialDate, initialView = "mes", events, tasks, calendars, feedUrl }: { month: string; today: string; initialDate?: string; initialView?: CalendarView; events: AgendaEvent[]; tasks: AgendaTask[]; calendars: Calendar[]; feedUrl: string | null }) {
  const router = useRouter();
  const [view, setView] = React.useState<CalendarView>(initialView);
  const [selected, setSelected] = React.useState(initialDate ?? (today.startsWith(month) ? today : `${month}-01`));
  const [showTasks, setShowTasks] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<AgendaEvent | null>(null);
  const [creating, setCreating] = React.useState<string | null>(null);
  const [navigating, navigate] = React.useTransition();
  const [syncing, sync] = React.useTransition();
  const base = parseISO(`${month}-01`);
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(base), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(base), { weekStartsOn: 1 }) }).map(iso);
  const weekDays = eachDayOfInterval({ start: startOfWeek(parseISO(selected), { weekStartsOn: 1 }), end: endOfWeek(parseISO(selected), { weekStartsOn: 1 }) }).map(iso);
  const term = query.trim().toLocaleLowerCase("pt-BR");
  const visibleEvents = events.filter((event) => !term || [event.title, event.calendarName, event.location, event.description].join(" ").toLocaleLowerCase("pt-BR").includes(term));
  const visibleTasks = showTasks ? tasks.filter((task) => !term || task.title.toLocaleLowerCase("pt-BR").includes(term)) : [];
  const byDay = new Map(days.map((day) => [day, visibleEvents.filter((event) => event.date <= day && event.lastDate >= day)]));
  const tasksByDay = new Map(days.map((day) => [day, visibleTasks.filter((task) => task.date === day)]));
  const dayEvents = byDay.get(selected) ?? [];
  const dayTasks = tasksByDay.get(selected) ?? [];
  const subscribed = calendars.filter((calendar) => calendar.kind === "ics" && calendar.enabled);
  const currentEvents = visibleEvents.filter((event) => event.date <= `${month}-31` && event.lastDate >= `${month}-01`);
  const title = view === "dia" ? format(parseISO(selected), "d 'de' MMMM", { locale: ptBR }) : view === "semana" ? `${format(parseISO(weekDays[0]), "d MMM", { locale: ptBR })} – ${format(parseISO(weekDays[6]), "d MMM, yyyy", { locale: ptBR })}` : format(base, "MMMM 'de' yyyy", { locale: ptBR });

  function goTo(date: string, nextView = view) {
    setSelected(date);
    setView(nextView);
    if (!date.startsWith(month)) navigate(() => router.push(`/agenda?mes=${date.slice(0, 7)}&data=${date}&visao=${nextView}`, { scroll: false }));
  }
  function move(delta: number) {
    goTo(iso(view === "mes" || view === "agenda" ? addMonths(parseISO(selected), delta) : addDays(parseISO(selected), delta * (view === "semana" ? 7 : 1))));
  }
  function synchronize() {
    sync(async () => {
      try {
        const report = await resyncCalendars();
        if (report.failed) toast.error(`${report.failed} calendário(s) com falha`, { description: report.errors.map((item) => `${item.calendar}: ${item.error}`).join(" · ") });
        else toast.success(report.synced ? `${report.events} eventos atualizados` : "Agenda atualizada");
        router.refresh();
      } catch (error) { toast.error(errorMessage(error)); }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        <span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-accent" />{currentEvents.length} evento{currentEvents.length !== 1 ? "s" : ""} no mês</span>
        <span className="flex items-center gap-2"><CheckSquare className="size-3.5" />{visibleTasks.filter((task) => task.date.startsWith(month) && !task.done).length} tarefas abertas</span>
        <span className="flex items-center gap-2"><Link2 className="size-3.5" />{subscribed.length} calendário{subscribed.length !== 1 ? "s" : ""} conectado{subscribed.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <Card className="overflow-hidden !rounded-3xl">
            <div className="space-y-4 border-b border-border p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="hidden h-14 w-12 shrink-0 overflow-hidden rounded-xl border border-border bg-surface-2 text-center sm:block"><div className="bg-accent/10 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-accent">{format(parseISO(today), "MMM", { locale: ptBR })}</div><div className="py-1 text-xl font-semibold tabular-nums">{Number(today.slice(8))}</div></div>
                <div className="min-w-0 flex-1"><h2 aria-live="polite" className="text-lg font-semibold capitalize tracking-tight sm:text-xl">{title}</h2><p className="mt-0.5 text-xs text-muted">{view === "mes" ? "Espaço para o que move seu dia." : view === "semana" ? "Organize compromissos e proteja seu tempo." : view === "dia" ? format(parseISO(selected), "EEEE, yyyy", { locale: ptBR }) : "Compromissos e tarefas reunidos por dia."}</p></div>
                <Button variant="ghost" size="icon" onClick={synchronize} disabled={syncing} aria-label="Sincronizar calendários" title="Sincronizar calendários"><RefreshCw className={cn(syncing && "animate-spin")} /></Button>
                <Button variant="primary" size="sm" onClick={() => setCreating(selected)}><Plus /><span className="hidden sm:inline">Novo evento</span><span className="sm:hidden">Evento</span></Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-2 p-0.5">
                  <Button size="icon-sm" variant="ghost" onClick={() => move(-1)} disabled={navigating} aria-label="Período anterior"><ChevronLeft /></Button>
                  <Button size="sm" variant="ghost" onClick={() => goTo(today)} disabled={navigating}>Hoje</Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => move(1)} disabled={navigating} aria-label="Próximo período"><ChevronRight /></Button>
                </div>
                <div role="group" aria-label="Visualização do calendário" className="grid w-full grid-cols-4 rounded-xl border border-border bg-surface-2 p-1 sm:w-auto">
                  {VIEWS.map(({ value, label, icon: Icon }) => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)} className={cn("flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-all duration-200 sm:px-3", view === value ? "bg-surface text-fg shadow-sm" : "text-muted hover:bg-surface/50 hover:text-fg")}><Icon className="size-3.5" />{label}</button>)}
                </div>
              </div>
              <div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-faint" /><Input aria-label="Buscar eventos e tarefas neste período" placeholder="Buscar neste período…" value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 border-transparent bg-surface-2/65 pl-9 text-[13px]" /></div>
            </div>
            <div aria-busy={navigating} className={cn("relative transition-opacity duration-200", navigating && "opacity-50")}>
              {navigating && <div className="absolute inset-x-0 top-2 z-30 mx-auto flex w-fit items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs shadow-soft" role="status"><LoaderCircle className="size-3.5 animate-spin" />Carregando período…</div>}
              {view === "mes" && <>
                <div className="grid grid-cols-7 border-b border-border bg-surface-2/30">{WD.map((day) => <div key={day} className="py-3 text-center text-[10px] font-semibold tracking-[0.12em] text-faint sm:text-[11px]">{day}</div>)}</div>
                <div className="grid grid-cols-7">
                  {days.map((day) => {
                    const evs = byDay.get(day) ?? [];
                    const tks = tasksByDay.get(day) ?? [];
                    const more = evs.length + tks.length - Math.min(evs.length, 2) - Math.min(tks.length, 1);
                    return <div key={day} className={cn("relative flex min-h-[74px] min-w-0 flex-col border-b border-r border-border p-1.5 transition-colors duration-150 sm:min-h-[126px] sm:p-2 [&:nth-child(7n)]:border-r-0", !day.startsWith(month) && "bg-surface-2/35 text-faint", selected === day && "bg-accent/8 ring-1 ring-inset ring-accent/40")}>
                      <button type="button" className="absolute inset-0 rounded-sm outline-none hover:bg-accent/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent" aria-label={`${longDate(day)}, ${evs.length} eventos e ${tks.length} tarefas`} aria-pressed={selected === day} onClick={() => goTo(day)} onDoubleClick={() => setCreating(day)} />
                      <time dateTime={day} className={cn("pointer-events-none relative grid size-7 place-items-center rounded-full text-[12px] tabular-nums", day === today && "bg-accent font-semibold text-accent-fg", selected === day && day !== today && "bg-accent/15 font-semibold text-accent")}>{Number(day.slice(8))}</time>
                      <div className="relative mt-1 hidden min-w-0 space-y-1 sm:block">
                        {evs.slice(0, 2).map((event) => <button key={event.id} onClick={() => setEditing(event)} title={`${event.title} · ${timeLabel(event)}`} className="block w-full truncate rounded-md border-l-2 px-1.5 py-1 text-left text-[10.5px] font-medium transition hover:brightness-125" style={{ color: event.color, borderColor: event.color, background: `color-mix(in oklab, ${event.color} 14%, transparent)` }}>{!event.allDay && event.date === day && <span className="mr-1 font-normal opacity-75">{event.start}</span>}{event.title}</button>)}
                        {tks.slice(0, 1).map((task) => <Link key={task.id} href={`/tarefas?task=${task.id}`} className={cn("flex items-center gap-1 truncate rounded px-1 text-[10.5px] text-muted hover:text-fg", task.done && "line-through opacity-60")}><CheckSquare className="size-3 shrink-0" /><span className="truncate">{task.title}</span></Link>)}
                        {more > 0 && <button onClick={() => goTo(day, "dia")} className="px-1 text-[10px] font-medium text-faint hover:text-fg">+{more} mais</button>}
                      </div>
                      <div className="pointer-events-none relative mt-auto flex flex-wrap justify-center gap-1 pb-1 sm:hidden">{evs.slice(0, 3).map((event) => <span key={event.id} className="size-1.5 rounded-full" style={{ background: event.color }} />)}{tks.length > 0 && <span className="size-1.5 rounded-full bg-muted" />}</div>
                    </div>;
                  })}
                </div>
              </>}
              {(view === "semana" || view === "dia") && <CalendarTimeGrid key={view} days={view === "dia" ? [selected] : weekDays} today={today} selected={selected} byDay={byDay} tasksByDay={tasksByDay} onSelect={goTo} onEvent={setEditing} onCreate={setCreating} />}
              {view === "agenda" && <div className="divide-y divide-border">
                {days.filter((day) => day.startsWith(month) && ((byDay.get(day)?.length ?? 0) + (tasksByDay.get(day)?.length ?? 0) > 0)).map((day) => <div key={day} className="grid gap-3 p-4 sm:grid-cols-[90px_minmax(0,1fr)] sm:p-5">
                  <button onClick={() => goTo(day, "dia")} className="flex items-baseline gap-2 self-start text-left sm:block"><span className={cn("text-2xl font-semibold tabular-nums", day === today && "text-accent")}>{Number(day.slice(8))}</span><span className="text-xs capitalize text-muted sm:mt-0.5 sm:block">{format(parseISO(day), "EEE, MMM", { locale: ptBR })}{day === today ? " · Hoje" : ""}</span></button>
                  <div className="min-w-0 space-y-2">{(byDay.get(day) ?? []).map((event) => <EventRow key={event.id} event={event} onClick={() => setEditing(event)} />)}{(tasksByDay.get(day) ?? []).map((task) => <TaskRow key={task.id} task={task} />)}</div>
                </div>)}
                {currentEvents.length + visibleTasks.filter((task) => task.date.startsWith(month)).length === 0 && <div className="flex flex-col items-center gap-2 px-5 py-16 text-center"><CalendarDays className="mb-2 size-8 text-faint" /><p className="text-sm font-medium">{term ? "Nenhum resultado neste período" : "Seu mês tem espaço para novos planos"}</p><p className="text-xs text-muted">{term ? "Experimente outra busca ou outro mês." : "Crie um evento ou conecte seu calendário."}</p><Button size="sm" variant="ghost" onClick={() => setCreating(selected)}><Plus />Criar evento</Button></div>}
              </div>}
            </div>
          </Card>
          {view === "mes" && <p className="hidden px-1 text-[11px] text-faint sm:block">Selecione um dia para ver os detalhes. Dê dois cliques no dia para criar um evento.</p>}
        </div>
        <aside className="min-w-0 space-y-4">
          <Card className="overflow-hidden !rounded-3xl">
            <div className="flex items-center gap-3 border-b border-border p-4"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-lg font-semibold tabular-nums text-accent">{Number(selected.slice(8))}</div><div className="min-w-0"><p className="text-[13px] font-semibold capitalize">{format(parseISO(selected), "EEEE", { locale: ptBR })}</p><p className="text-[11px] text-muted">{format(parseISO(selected), "d 'de' MMMM", { locale: ptBR })}{selected === today ? " · Hoje" : ""}</p></div><Button size="icon-sm" variant="ghost" className="ml-auto" onClick={() => setCreating(selected)} aria-label="Novo evento no dia selecionado"><Plus /></Button></div>
            <div className="space-y-2 p-3">{dayEvents.map((event) => <EventRow key={event.id} event={event} onClick={() => setEditing(event)} />)}{dayTasks.map((task) => <TaskRow key={task.id} task={task} />)}{dayEvents.length + dayTasks.length === 0 && <div className="px-2 py-7 text-center"><CalendarDays className="mx-auto mb-3 size-6 text-faint" /><p className="text-[13px] font-medium">{term ? "Nenhum resultado neste dia" : "Um espaço no seu dia"}</p><p className="mt-1 text-xs text-muted">{term ? "A busca também filtra os detalhes." : "Reserve tempo para o que importa."}</p><Button size="sm" variant="ghost" className="mt-3 text-accent" onClick={() => setCreating(selected)}><Plus />Adicionar evento</Button></div>}</div>
          </Card>
          <Card className="p-4 !rounded-3xl"><label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={showTasks} onChange={(event) => setShowTasks(event.target.checked)} className="accent-[var(--accent)]" /><CheckSquare className="size-3.5" />Mostrar tarefas com prazo</label></Card>
          <CalendarsPanel calendars={calendars} feedUrl={feedUrl} />
        </aside>
      </div>
      {(editing || creating) && <EventDialog event={editing} date={creating} onClose={() => { setEditing(null); setCreating(null); }} />}
    </div>
  );
}

function EventRow({ event, onClick }: { event: AgendaEvent; onClick: () => void }) {
  return <button onClick={onClick} className="flex w-full gap-3 rounded-xl p-2.5 text-left transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"><span className="w-[3px] shrink-0 rounded-full" style={{ background: event.color }} /><span className="min-w-0"><span className="block break-words text-[13px] font-medium">{event.title}</span><span className="mt-0.5 block text-[11px] text-muted">{timeLabel(event)}</span><span className="mt-0.5 block text-[10.5px] text-faint">{event.calendarName}{!event.editable && " · assinado"}</span>{event.location && <span className="mt-1 flex items-center gap-1 text-[11px] text-faint"><MapPin className="size-3 shrink-0" /><span className="truncate">{event.location}</span></span>}</span></button>;
}
function TaskRow({ task }: { task: AgendaTask }) {
  return <Link href={`/tarefas?task=${task.id}`} className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-[12px] transition hover:bg-surface-2"><CheckSquare className={cn("size-3.5 shrink-0", task.done ? "text-success" : "text-muted")} /><span className={cn("min-w-0 flex-1 break-words", task.done && "text-faint line-through")}>{task.title}</span><span className="text-[11px] tabular-nums text-faint">{task.time ?? "Sem horário"}</span></Link>;
}

function EventDialog({ event, date, onClose }: { event: AgendaEvent | null; date: string | null; onClose: () => void }) {
  const readonly = Boolean(event && !event.editable);
  const [f, setF] = React.useState(() => event ? { title: event.title, date: event.date, endDate: event.endDate, start: event.start ?? "09:00", end: event.end ?? "10:00", allDay: event.allDay, location: event.location ?? "", description: event.description ?? "", color: event.color } : { title: "", date: date!, endDate: date!, start: "09:00", end: "10:00", allDay: false, location: "", description: "", color: "#22c55e" });
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent title={readonly ? "Detalhes do evento" : event ? "Editar evento" : "Novo evento"} description={readonly ? `${event!.calendarName} · calendário assinado` : "Reserve um lugar na sua agenda."}>
        {readonly ? <div className="space-y-4"><h3 className="text-lg font-semibold">{event!.title}</h3><p className="flex items-center gap-2 text-sm capitalize text-muted"><CalendarDays className="size-4" />{longDate(event!.date)}</p><p className="flex items-center gap-2 text-sm text-muted"><Clock3 className="size-4" />{timeLabel(event!)}</p>{event!.location && <p className="flex gap-2 text-sm text-muted"><MapPin className="size-4 shrink-0" />{event!.location}</p>}{event!.description && <p className="whitespace-pre-wrap break-words rounded-xl bg-surface-2 p-3 text-[13px] text-muted">{event!.description}</p>}<p className="rounded-xl border border-border p-3 text-xs leading-relaxed text-faint">Para alterar este evento, abra o calendário de origem e depois sincronize a agenda.</p></div> : <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = { title: f.title, date: f.date, endDate: f.endDate || f.date, startTime: f.allDay ? null : f.start, endTime: f.allDay ? null : f.end, allDay: f.allDay, location: f.location || null, description: f.description || null, color: f.color || null };
            const parsed = eventFormSchema.safeParse(data);
            if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revise os dados do evento"); return; }
            setError(null);
            start(async () => {
              try { await saveEvent(event?.id ?? null, data); toast.success("Evento salvo"); onClose(); }
              catch (cause) { setError(errorMessage(cause)); }
            });
          }}
          className="space-y-3"
        >
          <Field label="Título"><Input autoFocus required maxLength={300} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="O que vai acontecer?" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Início"><Input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value, endDate: f.endDate < e.target.value ? e.target.value : f.endDate })} /></Field>
            <Field label="Fim"><Input type="date" value={f.endDate} min={f.date} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field>
            {!f.allDay && <Field label="Hora início"><Input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>}
            {!f.allDay && <Field label="Hora fim"><Input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>}
          </div>
          <label className="flex items-center gap-2 text-[13px] text-muted"><input type="checkbox" checked={f.allDay} onChange={(e) => setF({ ...f, allDay: e.target.checked })} className="accent-[var(--accent)]" /> Dia inteiro</label>
          <Field label="Local"><Input maxLength={300} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Opcional" /></Field>
          <Field label="Descrição"><Textarea maxLength={5000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Contexto, pauta ou link da reunião" className="min-h-16" /></Field>
          <Field label="Cor"><ColorPicker value={f.color} onChange={(color) => setF({ ...f, color })} /></Field>
          {error && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-xs text-danger">{error}</p>}
          <div className="flex gap-2">
            {event && <Button type="button" variant="danger" disabled={pending} onClick={() => { if (!confirm(`Excluir “${event.title}”?`)) return; start(async () => { try { await deleteEvent(event.id); toast.success("Evento excluído"); onClose(); } catch (cause) { setError(errorMessage(cause)); } }); }}><Trash2 /> Excluir</Button>}
            <Button type="button" variant="ghost" className="ml-auto" disabled={pending} onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</Button>
          </div>
        </form>}
      </DialogContent>
    </Dialog>
  );
}

function CalendarsPanel({ calendars, feedUrl }: { calendars: Calendar[]; feedUrl: string | null }) {
  const [adding, setAdding] = React.useState(false);
  const [f, setF] = React.useState({ name: "", url: "", color: "#22c55e" });
  const [pending, start] = React.useTransition();
  const run = (action: () => Promise<unknown>) => start(async () => { try { await action(); } catch (error) { toast.error(errorMessage(error)); } });
  return (
    <Card className="!rounded-3xl p-4">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold"><CalendarDays className="size-4 text-muted" /> Meus calendários</div>
      <div className="space-y-1">
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px]"><span className="size-2.5 rounded-full bg-success" /> Órbita <span className="ml-auto text-[11px] text-faint">local</span></div>
        {calendars.filter((c) => c.kind === "ics").map((c) => (
          <div key={c.id} className="group rounded-lg px-2 py-1.5">
            <div className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={c.enabled} disabled={pending} onChange={(e) => run(() => updateCalendar(c.id, { enabled: e.target.checked }))} style={{ accentColor: c.color }} aria-label={`Mostrar ${c.name}`} />
              <span className="truncate">{c.name}</span>
              <button disabled={pending} onClick={() => run(async () => { const r = await resyncCalendar(c.id); if (r.error) toast.error(r.error); else toast.success(`${r.count} eventos sincronizados`); })} className="ml-auto rounded p-1 text-faint hover:text-fg disabled:opacity-40" aria-label={`Sincronizar ${c.name}`}><RefreshCw className={cn("size-3.5", pending && "animate-spin")} /></button>
              <button disabled={pending} onClick={() => { if (confirm(`Remover a assinatura “${c.name}”? Os eventos desta origem sairão da agenda.`)) run(() => deleteCalendar(c.id)); }} className="rounded p-1 text-faint hover:text-danger disabled:opacity-40" aria-label={`Remover ${c.name}`}><Trash2 className="size-3.5" /></button>
            </div>
            <div className={cn("pl-6 text-[11px]", c.lastError ? "text-danger" : "text-faint")}>{c.lastError ? c.lastError : c.lastSyncedAt ? `Sincronizado ${new Date(c.lastSyncedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "Nunca sincronizado"}</div>
          </div>
        ))}
      </div>
      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const r = await addIcsCalendar(f);
              if (r.error) toast.error(r.error);
              else toast.success(`${r.count} eventos importados`);
              setAdding(false);
              setF({ name: "", url: "", color: "#22c55e" });
            });
          }}
          className="mt-3 space-y-2 rounded-xl border border-border p-3"
        >
          <Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nome (ex.: iCloud pessoal)" className="h-9" />
          <Input required value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="webcal://… ou https://….ics" className="h-9" />
          <ColorPicker value={f.color} onChange={(color) => setF({ ...f, color })} />
          <div className="flex gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button><Button size="sm" variant="primary" className="ml-auto" disabled={pending}>{pending ? "Importando…" : "Assinar"}</Button></div>
        </form>
      ) : (
        <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => setAdding(true)}><Link2 /> Conectar calendário</Button>
      )}
      <details className="mt-4 text-[12.5px] text-muted">
        <summary className="cursor-pointer font-medium text-fg">Como sincronizar com o iPhone</summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4">
          <li><b>iPhone → Órbita:</b> no app Calendário do iPhone, toque em “Calendários”, no ⓘ do calendário, ative <i>Calendário Público</i> e copie o link <code>webcal://</code>. Cole aqui em “Assinar calendário”.</li>
          <li><b>Órbita → iPhone:</b> em Ajustes → Calendário → Contas → Adicionar conta → Outra → <i>Adicionar Calendário Assinado</i>, cole o link do feed abaixo.</li>
          <li>Google Agenda: use o “Endereço secreto no formato iCal” das configurações da agenda.</li>
        </ol>
      </details>
      {feedUrl ? (
        <button onClick={async () => { try { await navigator.clipboard.writeText(feedUrl); toast.success("Link do feed copiado"); } catch { toast.error("O navegador não permitiu copiar o link"); } }} className="mt-3 flex w-full items-center gap-2 rounded-xl border border-dashed border-border-strong px-3 py-2 text-left text-[12px] text-muted hover:text-fg">
          <Copy className="size-3.5 shrink-0" /><span className="truncate">Copiar assinatura da Órbita</span>
        </button>
      ) : (
        <p className="mt-3 rounded-xl bg-surface-2 p-2.5 text-[12px] text-faint">A assinatura de saída ainda não está configurada. <Link href="/integracoes" className="text-accent hover:underline">Ver integrações</Link></p>
      )}
    </Card>
  );
}
