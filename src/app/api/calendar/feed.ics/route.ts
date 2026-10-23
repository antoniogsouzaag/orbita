import { and, gte, isNotNull, isNull, ne } from "drizzle-orm";
import { type NextRequest } from "next/server";
import { getDb } from "@/db";
import { events, tasks } from "@/db/schema";
import { tokenMatches } from "@/lib/auth";
import { shiftDate, today, zonedToUtc } from "@/lib/dates";
import { buildIcs } from "@/server/calendar";

/** Feed ICS somente leitura com os eventos locais da Órbita (+ tarefas com data, opcional). */
export async function GET(req: NextRequest) {
  if (!tokenMatches(req.nextUrl.searchParams.get("token"), "CALENDAR_FEED_TOKEN")) return new Response("unauthorized", { status: 401 });
  const includeTasks = req.nextUrl.searchParams.get("tarefas") !== "0";
  const db = await getDb();
  const since = zonedToUtc(shiftDate(today(), -60));
  const local = await db.select().from(events).where(and(isNull(events.calendarId), gte(events.endAt, since)));
  const items = local.map((e) => ({ uid: e.id, title: e.title, description: e.description, location: e.location, startAt: e.startAt, endAt: e.endAt, allDay: e.allDay }));
  if (includeTasks) {
    const tks = await db.select().from(tasks).where(and(isNull(tasks.parentId), isNotNull(tasks.dueDate), ne(tasks.status, "done"), gte(tasks.dueDate, shiftDate(today(), -30))));
    for (const t of tks) {
      if (t.dueTime) {
        const s = zonedToUtc(t.dueDate!, t.dueTime);
        items.push({ uid: `task-${t.id}`, title: `☐ ${t.title}`, description: t.notes, location: null, startAt: s, endAt: new Date(s.getTime() + 30 * 60_000), allDay: false });
      } else {
        const s = new Date(`${t.dueDate}T00:00:00Z`);
        items.push({ uid: `task-${t.id}`, title: `☐ ${t.title}`, description: t.notes, location: null, startAt: s, endAt: new Date(s.getTime() + 86_400_000), allDay: true });
      }
    }
  }
  return new Response(buildIcs(items, "Órbita"), { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-store" } });
}
