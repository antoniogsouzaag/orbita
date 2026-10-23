"use client";

import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, CheckSquare, ChevronLeft, ChevronRight, Copy, Link2, MapPin, Plus, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { addIcsCalendar, deleteCalendar, deleteEvent, resyncCalendar, saveEvent, updateCalendar } from "@/app/actions/calendar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ColorPicker } from "@/components/ui/color";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/misc";
import type { Calendar } from "@/db/schema";
import { cn } from "@/lib/utils";

export type AgendaEvent = { id: string; title: string; date: string; endDate: string; start: string | null; end: string | null; allDay: boolean; color: string; calendarName: string; editable: boolean; location: string | null; description: string | null };
export type AgendaTask = { id: string; title: string; date: string; time: string | null; done: boolean; color: string };

const WD = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

export function AgendaPage({ month, today, events, tasks, calendars, feedUrl }: { month: string; today: string; events: AgendaEvent[]; tasks: AgendaTask[]; calendars: Calendar[]; feedUrl: string | null }) {
  const router = useRouter();
  const [view, setView] = React.useState<"mes" | "lista">("mes");
  const [showTasks, setShowTasks] = React.useState(true);
  const [selected, setSelected] = React.useState(today.slice(0, 7) === month ? today : `${month}-01`);
  const [editing, setEditing] = React.useState<AgendaEvent | null>(null);
  const [creating, setCreating] = React.useState<string | null>(null);
  const base = parseISO(`${month}-01`);
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(base), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(base), { weekStartsOn: 1 }) }).map((d) => format(d, "yyyy-MM-dd"));

  const byDay = React.useMemo(() => {
    const m = new Map<string, AgendaEvent[]>();
    for (const e of events) {
      let d = e.date;
      while (d <= e.endDate) {
        if (!m.has(d)) m.set(d, []);
        m.get(d)!.push(e);
        d = format(new Date(parseISO(d).getTime() + 86_400_000), "yyyy-MM-dd");
        if (m.size > 400) break;
      }
    }
    return m;
  }, [events]);
  const tasksByDay = React.useMemo(() => {
    const m = new Map<string, AgendaTask[]>();
    for (const t of tasks) {
      if (!m.has(t.date)) m.set(t.date, []);
      m.get(t.date)!.push(t);
    }
    return m;
  }, [tasks]);

  const nav = (delta: number) => router.push(`/agenda?mes=${format(addMonths(base, delta), "yyyy-MM")}`);
  const dayEvents = byDay.get(selected) ?? [];
  const dayTasks = showTasks ? tasksByDay.get(selected) ?? [] : [];
  const upcoming = events.filter((e) => e.endDate >= today).slice(0, 60);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="icon-sm" variant="secondary" onClick={() => nav(-1)} aria-label="Mês anterior"><ChevronLeft /></Button>
          <Button size="icon-sm" variant="secondary" onClick={() => nav(1)} aria-label="Próximo mês"><ChevronRight /></Button>
          <h2 className="ml-1 text-lg font-semibold capitalize">{format(base, "MMMM 'de' yyyy", { locale: ptBR })}</h2>
          {today.slice(0, 7) !== month && <Button size="sm" variant="ghost" asChild><Link href="/agenda">Hoje</Link></Button>}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setShowTasks((v) => !v)} className={cn("flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12.5px]", showTasks ? "text-fg" : "text-faint")}><CheckSquare className="size-3.5" /> Tarefas</button>
            <Segmented value={view} onChange={setView} options={[{ value: "mes", label: "Mês" }, { value: "lista", label: "Lista" }]} />
            <Button size="sm" variant="primary" onClick={() => setCreating(selected)}><Plus /> Evento</Button>
          </div>
        </div>

        {view === "mes" ? (
          <Card className="overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border">{WD.map((d) => <div key={d} className="py-2 text-center text-[11px] font-semibold tracking-wider text-faint">{d}</div>)}</div>
            <div className="grid grid-cols-7">
              {days.map((d) => {
                const evs = byDay.get(d) ?? [];
                const tks = showTasks ? tasksByDay.get(d) ?? [] : [];
                const inMonth = isSameMonth(parseISO(d), base);
                const isToday = d === today;
                return (
                  <button
                    key={d}
                    onClick={() => setSelected(d)}
                    onDoubleClick={() => setCreating(d)}
                    className={cn("flex min-h-[64px] flex-col gap-0.5 border-b border-r border-border p-1 text-left transition sm:min-h-[104px] sm:p-1.5 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-surface-2/40 text-faint", selected === d && "bg-accent/8 ring-1 ring-inset ring-accent/50")}
                  >
                    <span className={cn("grid size-6 place-items-center rounded-full text-[12px] tabular-nums", isToday && "bg-accent font-bold text-accent-fg")}>{Number(d.slice(8))}</span>
                    <div className="hidden w-full space-y-0.5 sm:block">
                      {evs.slice(0, 3).map((e) => (
                        <div key={e.id + d} className="truncate rounded px-1 py-px text-[11px]" style={{ background: `color-mix(in oklab, ${e.color} 20%, transparent)`, color: e.color }}>
                          {!e.allDay && e.date === d && <span className="tabular-nums opacity-80">{e.start} </span>}{e.title}
                        </div>
                      ))}
                      {tks.slice(0, 2).map((t) => <div key={t.id} className={cn("truncate px-1 text-[11px] text-muted", t.done && "line-through opacity-60")}>☐ {t.title}</div>)}
                      {evs.length + tks.length > 5 && <div className="px-1 text-[10.5px] text-faint">+{evs.length + tks.length - 5}</div>}
                    </div>
                    <div className="flex gap-0.5 sm:hidden">{[...evs.slice(0, 3)].map((e) => <span key={e.id} className="size-1.5 rounded-full" style={{ background: e.color }} />)}{tks.length > 0 && <span className="size-1.5 rounded-full bg-muted" />}</div>
                  </button>
                );
              })}
            </div>
          </Card>
        ) : (
          <Card className="divide-y divide-border">
            {upcoming.length === 0 && <p className="p-6 text-center text-[13px] text-muted">Nenhum evento a partir de hoje neste período.</p>}
            {upcoming.map((e) => (
              <button key={e.id} onClick={() => e.editable ? setEditing(e) : setSelected(e.date)} className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-surface-2">
                <div className="w-20 shrink-0 text-[12px] text-muted"><div className="font-semibold capitalize text-fg">{format(parseISO(e.date), "EEE, d MMM", { locale: ptBR })}</div>{e.allDay ? "Dia todo" : `${e.start}–${e.end}`}</div>
                <span className="h-8 w-[3px] rounded-full" style={{ background: e.color }} />
                <div className="min-w-0 flex-1"><div className="truncate text-[14px]">{e.title}</div><div className="truncate text-[12px] text-faint">{e.calendarName}{e.location && ` · ${e.location}`}</div></div>
              </button>
            ))}
          </Card>
        )}
      </div>

      <aside className="space-y-4">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-semibold capitalize">{format(parseISO(selected), "EEEE, d 'de' MMMM", { locale: ptBR })}</div>
            <Button size="icon-sm" variant="ghost" onClick={() => setCreating(selected)} aria-label="Novo evento neste dia"><Plus /></Button>
          </div>
          {dayEvents.length === 0 && dayTasks.length === 0 && <p className="text-[13px] text-muted">Dia livre.</p>}
          <div className="space-y-2">
            {dayEvents.map((e) => (
              <button key={e.id} onClick={() => e.editable && setEditing(e)} className={cn("flex w-full gap-3 rounded-xl p-2 text-left", e.editable && "hover:bg-surface-2")}>
                <span className="w-[3px] shrink-0 rounded-full" style={{ background: e.color }} />
                <span className="min-w-0">
                  <span className="block text-[13.5px]">{e.title}</span>
                  <span className="block text-[12px] text-muted">{e.allDay ? "Dia todo" : `${e.start} – ${e.end}`} · {e.calendarName}</span>
                  {e.location && <span className="flex items-center gap-1 text-[12px] text-faint"><MapPin className="size-3" />{e.location}</span>}
                </span>
              </button>
            ))}
            {dayTasks.map((t) => (
              <Link key={t.id} href={`/tarefas?task=${t.id}`} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-[13px] hover:bg-surface-2">
                <CheckSquare className={cn("size-3.5", t.done ? "text-success" : "text-muted")} /><span className={cn("truncate", t.done && "line-through text-faint")}>{t.title}</span>{t.time && <span className="ml-auto text-[12px] text-faint">{t.time}</span>}
              </Link>
            ))}
          </div>
        </Card>
        <CalendarsPanel calendars={calendars} feedUrl={feedUrl} />
      </aside>

      <EventDialog event={editing} date={creating} onClose={() => { setEditing(null); setCreating(null); }} />
    </div>
  );
}

function EventDialog({ event, date, onClose }: { event: AgendaEvent | null; date: string | null; onClose: () => void }) {
  const open = Boolean(event || date);
  const [f, setF] = React.useState({ title: "", date: "", endDate: "", start: "09:00", end: "10:00", allDay: false, location: "", description: "", color: "" });
  const [pending, start] = React.useTransition();
  React.useEffect(() => {
    if (event) setF({ title: event.title, date: event.date, endDate: event.endDate, start: event.start ?? "09:00", end: event.end ?? "10:00", allDay: event.allDay, location: event.location ?? "", description: event.description ?? "", color: event.color });
    else if (date) setF({ title: "", date, endDate: date, start: "09:00", end: "10:00", allDay: false, location: "", description: "", color: "" });
  }, [event, date]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={event ? "Editar evento" : "Novo evento"}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              await saveEvent(event?.id ?? null, { title: f.title, date: f.date, endDate: f.endDate || f.date, startTime: f.allDay ? null : f.start, endTime: f.allDay ? null : f.end, allDay: f.allDay, location: f.location || null, description: f.description || null, color: f.color || null });
              toast.success("Evento salvo");
              onClose();
            });
          }}
          className="space-y-3"
        >
          <Input autoFocus required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Título" />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Início"><Input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value, endDate: f.endDate < e.target.value ? e.target.value : f.endDate })} /></Field>
            <Field label="Fim"><Input type="date" value={f.endDate} min={f.date} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field>
            {!f.allDay && <Field label="Hora início"><Input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>}
            {!f.allDay && <Field label="Hora fim"><Input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>}
          </div>
          <label className="flex items-center gap-2 text-[13px] text-muted"><input type="checkbox" checked={f.allDay} onChange={(e) => setF({ ...f, allDay: e.target.checked })} className="accent-[var(--accent)]" /> Dia inteiro</label>
          <Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Local" />
          <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Descrição" className="min-h-16" />
          <Field label="Cor"><ColorPicker value={f.color} onChange={(color) => setF({ ...f, color })} /></Field>
          <div className="flex gap-2">
            {event && <Button type="button" variant="danger" onClick={() => start(async () => { await deleteEvent(event.id); toast.success("Evento excluído"); onClose(); })}><Trash2 /> Excluir</Button>}
            <Button variant="primary" className="ml-auto" disabled={pending}>Salvar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CalendarsPanel({ calendars, feedUrl }: { calendars: Calendar[]; feedUrl: string | null }) {
  const [adding, setAdding] = React.useState(false);
  const [f, setF] = React.useState({ name: "", url: "", color: "#22c55e" });
  const [pending, start] = React.useTransition();
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2 font-semibold"><CalendarDays className="size-4 text-muted" /> Calendários</div>
      <div className="space-y-1">
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px]"><span className="size-2.5 rounded-full bg-success" /> Órbita <span className="ml-auto text-[11px] text-faint">local</span></div>
        {calendars.filter((c) => c.kind === "ics").map((c) => (
          <div key={c.id} className="group rounded-lg px-2 py-1.5">
            <div className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={c.enabled} onChange={(e) => start(() => updateCalendar(c.id, { enabled: e.target.checked }))} style={{ accentColor: c.color }} aria-label="Mostrar" />
              <span className="truncate">{c.name}</span>
              <button onClick={() => start(async () => { const r = await resyncCalendar(c.id); if (r.error) toast.error(r.error); else toast.success(`${r.count} eventos sincronizados`); })} className="ml-auto rounded p-1 text-faint hover:text-fg" aria-label="Sincronizar"><RefreshCw className={cn("size-3.5", pending && "animate-spin")} /></button>
              <button onClick={() => start(async () => { if (confirm(`Remover “${c.name}”?`)) await deleteCalendar(c.id); })} className="rounded p-1 text-faint hover:text-danger" aria-label="Remover"><Trash2 className="size-3.5" /></button>
            </div>
            <div className={cn("pl-6 text-[11px]", c.lastError ? "text-danger" : "text-faint")}>{c.lastError ? c.lastError : c.lastSyncedAt ? `Sincronizado ${new Date(c.lastSyncedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "Nunca sincronizado"}</div>
          </div>
        ))}
      </div>
      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
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
        <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => setAdding(true)}><Link2 /> Assinar calendário (iCloud/Google)</Button>
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
        <button onClick={() => { navigator.clipboard.writeText(feedUrl); toast.success("Link do feed copiado"); }} className="mt-3 flex w-full items-center gap-2 rounded-xl border border-dashed border-border-strong px-3 py-2 text-left text-[12px] text-muted hover:text-fg">
          <Copy className="size-3.5 shrink-0" /><span className="truncate">{feedUrl}</span>
        </button>
      ) : (
        <p className="mt-3 rounded-xl bg-surface-2 p-2.5 text-[12px] text-faint">Defina <code>CALENDAR_FEED_TOKEN</code> para gerar o link do feed.</p>
      )}
    </Card>
  );
}
