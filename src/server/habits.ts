import "server-only";
import { and, asc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { habitLogs, habits, type Habit } from "@/db/schema";
import { shiftDate, today } from "@/lib/dates";
import { currentStreak, isScheduled, lastDays, weekCount, type DayCell } from "@/lib/habits";

export type HabitWithStats = Habit & {
  doneToday: boolean;
  scheduledToday: boolean;
  streak: { value: number; unit: "dias" | "sem" };
  last7: DayCell[];
  weekDone: number;
  logs: string[];
};

export async function listHabits(opts: { days?: number; includeArchived?: boolean } = {}): Promise<HabitWithStats[]> {
  const db = await getDb();
  const t = today();
  const since = shiftDate(t, -(opts.days ?? 400));
  const [rows, logs] = await Promise.all([
    db.select().from(habits).where(opts.includeArchived ? undefined : eq(habits.archived, false)).orderBy(asc(habits.sort), asc(habits.createdAt)),
    db.select({ habitId: habitLogs.habitId, date: habitLogs.date }).from(habitLogs).where(gte(habitLogs.date, since)),
  ]);
  const byHabit = new Map<string, Set<string>>();
  for (const l of logs) {
    if (!byHabit.has(l.habitId)) byHabit.set(l.habitId, new Set());
    byHabit.get(l.habitId)!.add(l.date);
  }
  return rows.map((h) => {
    const done = byHabit.get(h.id) ?? new Set<string>();
    return {
      ...h,
      doneToday: done.has(t),
      scheduledToday: isScheduled(h, t),
      streak: currentStreak(h, done, t),
      last7: lastDays(h, done, t, 7),
      weekDone: weekCount(done, t),
      logs: [...done].sort(),
    };
  });
}

export async function habitLogDates(since: string) {
  const db = await getDb();
  return db
    .select({ habitId: habitLogs.habitId, date: habitLogs.date, area: habits.area })
    .from(habitLogs)
    .innerJoin(habits, eq(habits.id, habitLogs.habitId))
    .where(and(gte(habitLogs.date, since)));
}
