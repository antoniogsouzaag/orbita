import "server-only";
import { and, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { focusSessions } from "@/db/schema";
import { lastNDays, localDate, shiftDate, today, zonedToUtc } from "@/lib/dates";
import { isScheduled } from "@/lib/habits";
import { checkinsSince } from "./checkins";
import { listHabits } from "./habits";
import { focusScopeWhere, txSince } from "./life";
import { completedOnDays } from "./tasks";

export async function reviewData(days = 30) {
  const t = today();
  const from = shiftDate(t, -(days - 1));
  const db = await getDb();
  const [habits, completions, checkins, focus, tx] = await Promise.all([
    listHabits({ days: days + 10 }),
    completedOnDays(from, "pessoal"),
    checkinsSince(from),
    db.select({ startedAt: focusSessions.startedAt, minutes: focusSessions.minutes }).from(focusSessions).where(and(gte(focusSessions.startedAt, zonedToUtc(from)), focusScopeWhere("pessoal"))),
    txSince(from),
  ]);
  const doneByDay = new Map<string, number>();
  for (const c of completions) if (c.completedAt) doneByDay.set(localDate(c.completedAt), (doneByDay.get(localDate(c.completedAt)) ?? 0) + 1);
  const focusByDay = new Map<string, number>();
  for (const f of focus) focusByDay.set(localDate(f.startedAt), (focusByDay.get(localDate(f.startedAt)) ?? 0) + f.minutes);
  const spendByDay = new Map<string, number>();
  for (const x of tx) if (x.kind === "despesa") spendByDay.set(x.date, (spendByDay.get(x.date) ?? 0) + Number(x.amount));
  const ck = new Map(checkins.map((c) => [c.date, c]));

  const series = lastNDays(days, t).map((d) => {
    const sched = habits.filter((h) => isScheduled(h, d) && h.frequency !== "weekly" && localDate(new Date(h.createdAt)) <= d);
    const done = sched.filter((h) => h.logs.includes(d)).length;
    return {
      date: d,
      label: `${d.slice(8)}/${d.slice(5, 7)}`,
      tasks: doneByDay.get(d) ?? 0,
      habits: sched.length ? Math.round((done / sched.length) * 100) : null,
      focus: focusByDay.get(d) ?? 0,
      mood: ck.get(d)?.mood ?? null,
      energy: ck.get(d)?.energy ?? null,
      spend: Math.round((spendByDay.get(d) ?? 0) * 100) / 100,
    };
  });
  const last7 = series.slice(-7);
  const prev7 = series.slice(-14, -7);
  const sum = (arr: typeof series, k: "tasks" | "focus" | "spend") => arr.reduce((s, x) => s + x[k], 0);
  const avg = (arr: (number | null)[]) => {
    const v = arr.filter((x): x is number => x !== null);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };
  return {
    series,
    week: {
      tasks: sum(last7, "tasks"),
      tasksPrev: sum(prev7, "tasks"),
      focus: sum(last7, "focus"),
      focusPrev: sum(prev7, "focus"),
      habits: avg(last7.map((x) => x.habits)),
      habitsPrev: avg(prev7.map((x) => x.habits)),
      mood: avg(last7.map((x) => x.mood)),
      energy: avg(last7.map((x) => x.energy)),
      spend: sum(last7, "spend"),
    },
    notes: checkins.filter((c) => c.note && c.date <= t).reverse(),
  };
}
