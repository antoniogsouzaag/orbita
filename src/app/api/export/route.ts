import { NextResponse } from "next/server";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { isAuthenticated } from "@/lib/auth";
import { today } from "@/lib/dates";

/** Backup completo dos dados pessoais em JSON (exceto segredos de segurança). */
export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = await getDb();
  const [projects, tasks, goals, habits, habitLogs, calendars, events, notes, checkins, focusSessions, transactions, workouts, books, dayPlans, settings] = await Promise.all([
    db.select().from(s.projects), db.select().from(s.tasks), db.select().from(s.goals), db.select().from(s.habits), db.select().from(s.habitLogs),
    db.select().from(s.calendars), db.select().from(s.events), db.select().from(s.notes), db.select().from(s.checkins), db.select().from(s.focusSessions),
    db.select().from(s.transactions), db.select().from(s.workouts), db.select().from(s.books), db.select().from(s.dayPlans), db.select().from(s.settings),
  ]);
  const body = {
    exportedAt: new Date().toISOString(),
    app: "orbita",
    data: { projects, tasks, goals, habits, habitLogs, calendars: calendars.map((c) => ({ ...c, url: c.url ? "(oculto)" : null })), events: events.filter((e) => !e.calendarId), notes, checkins, focusSessions, transactions, workouts, books, dayPlans, settings: settings.filter((x) => !["security", "capture_token"].includes(x.key)) },
  };
  return new NextResponse(JSON.stringify(body, null, 2), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="orbita-backup-${today()}.json"`, "cache-control": "no-store" } });
}
