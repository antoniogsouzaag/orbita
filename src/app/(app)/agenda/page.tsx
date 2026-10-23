import { addDays, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { and, gte, isNotNull, isNull, lte } from "drizzle-orm";
import { CalendarDays } from "lucide-react";
import { headers } from "next/headers";
import { AgendaPage, type AgendaEvent } from "@/components/agenda/agenda-page";
import { PageHeader } from "@/components/ui/card";
import { getDb } from "@/db";
import { projects, tasks } from "@/db/schema";
import { localDate, localTime, today, zonedToUtc } from "@/lib/dates";
import { eventsBetween, listCalendars, syncStaleCalendars } from "@/server/calendar";
import { eq } from "drizzle-orm";

export const metadata = { title: "Agenda" };

export default async function Page({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const t = today();
  const month = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : t.slice(0, 7);
  const base = parseISO(`${month}-01`);
  const from = format(startOfWeek(startOfMonth(base), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const to = format(addDays(endOfWeek(endOfMonth(base), { weekStartsOn: 1 }), 1), "yyyy-MM-dd");
  await syncStaleCalendars(30).catch(() => {});
  const db = await getDb();
  const [evs, cals, tks, h] = await Promise.all([
    eventsBetween(zonedToUtc(from), zonedToUtc(to)),
    listCalendars(),
    db
      .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, dueTime: tasks.dueTime, status: tasks.status, color: projects.color })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(isNull(tasks.parentId), isNotNull(tasks.dueDate), gte(tasks.dueDate, from), lte(tasks.dueDate, to))),
    headers(),
  ]);
  const events: AgendaEvent[] = evs.map((e) => {
    const date = e.allDay ? e.startAt.toISOString().slice(0, 10) : localDate(e.startAt);
    const endDate = e.allDay ? new Date(e.endAt.getTime() - 1).toISOString().slice(0, 10) : localDate(new Date(e.endAt.getTime() - 1));
    return { id: e.id, title: e.title, date, endDate: endDate < date ? date : endDate, start: e.allDay ? null : localTime(e.startAt), end: e.allDay ? null : localTime(e.endAt), allDay: e.allDay, color: e.color, calendarName: e.calendarName, editable: e.editable, location: e.location, description: e.description };
  });
  const token = process.env.CALENDAR_FEED_TOKEN;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const feedUrl = token && host ? `${proto === "http" && !host.startsWith("localhost") ? "https" : proto}://${host}/api/calendar/feed.ics?token=${token}` : null;
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <PageHeader icon={<CalendarDays />} title="Agenda" description="Seus compromissos, calendários assinados e tarefas com data." />
      <AgendaPage
        month={month}
        today={t}
        events={events}
        tasks={tks.map((x) => ({ id: x.id, title: x.title, date: x.dueDate!, time: x.dueTime, done: x.status === "done", color: x.color ?? "#94a3b8" }))}
        calendars={cals}
        feedUrl={feedUrl}
      />
    </div>
  );
}
