import "server-only";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { books, dayPlans, focusSessions, tasks, transactions, workouts, type TaskScope } from "@/db/schema";
import { shiftDate, startOfWeekISO, today, zonedToUtc } from "@/lib/dates";

export function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const start = `${ym}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { start, end };
}

export async function financeMonth(ym = today().slice(0, 7)) {
  const db = await getDb();
  const { start, end } = monthRange(ym);
  const rows = await db.select().from(transactions).where(and(gte(transactions.date, start), lte(transactions.date, end))).orderBy(desc(transactions.date), desc(transactions.createdAt));
  const income = rows.filter((r) => r.kind === "receita").reduce((s, r) => s + Number(r.amount), 0);
  const expense = rows.filter((r) => r.kind === "despesa").reduce((s, r) => s + Number(r.amount), 0);
  const byCategory = new Map<string, number>();
  for (const r of rows.filter((r) => r.kind === "despesa")) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + Number(r.amount));
  const categories = [...byCategory.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  return { ym, rows, income, expense, balance: income - expense, categories };
}

export async function financeHistory(months = 6) {
  const db = await getDb();
  const start = `${shiftDate(today(), -31 * (months - 1)).slice(0, 7)}-01`;
  const rows = await db
    .select({ ym: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`, kind: transactions.kind, total: sql<number>`sum(${transactions.amount})::float` })
    .from(transactions)
    .where(gte(transactions.date, start))
    .groupBy(sql`1`, transactions.kind)
    .orderBy(sql`1`);
  const map = new Map<string, { ym: string; receita: number; despesa: number }>();
  for (const r of rows) {
    if (!map.has(r.ym)) map.set(r.ym, { ym: r.ym, receita: 0, despesa: 0 });
    map.get(r.ym)![r.kind as "receita" | "despesa"] = Number(r.total);
  }
  return [...map.values()];
}

export async function listWorkouts(limit = 60) {
  const db = await getDb();
  return db.select().from(workouts).orderBy(desc(workouts.date), desc(workouts.createdAt)).limit(limit);
}

export async function workoutStats() {
  const db = await getDb();
  const t = today();
  const [row] = await db.select({
    week: sql<number>`count(*) filter (where ${workouts.date} >= ${startOfWeekISO(t)})::int`,
    month: sql<number>`count(*) filter (where ${workouts.date} >= ${shiftDate(t, -29)})::int`,
  }).from(workouts).where(lte(workouts.date, t));
  return row;
}

export async function listBooks() {
  const db = await getDb();
  return db.select().from(books).orderBy(sql`case ${books.status} when 'lendo' then 0 when 'quero' then 1 else 2 end`, desc(books.createdAt));
}

export function focusScopeWhere(scope: TaskScope) {
  return sql`coalesce((select task.scope from ${tasks} task where task.id = ${focusSessions.taskId}), 'pessoal') = ${scope}`;
}

export async function focusStats(scope?: TaskScope) {
  const db = await getDb();
  const t = today();
  const weekStart = zonedToUtc(startOfWeekISO(t));
  const dayStart = zonedToUtc(t);
  const monthAgo = zonedToUtc(shiftDate(t, -29));
  const [s] = await db
    .select({
      week: sql<number>`coalesce(sum(${focusSessions.minutes}) filter (where ${focusSessions.startedAt} >= ${weekStart.toISOString()}), 0)::int`,
      today: sql<number>`coalesce(sum(${focusSessions.minutes}) filter (where ${focusSessions.startedAt} >= ${dayStart.toISOString()}), 0)::int`,
      month: sql<number>`coalesce(sum(${focusSessions.minutes}) filter (where ${focusSessions.startedAt} >= ${monthAgo.toISOString()}), 0)::int`,
      sessions: sql<number>`count(*) filter (where ${focusSessions.startedAt} >= ${weekStart.toISOString()})::int`,
    })
    .from(focusSessions).where(scope ? focusScopeWhere(scope) : undefined);
  const recent = await db.select().from(focusSessions).where(scope ? focusScopeWhere(scope) : undefined).orderBy(desc(focusSessions.startedAt)).limit(20);
  return { ...s, avgDaily: Math.round(s.month / 30), recent };
}

export async function getDayPlan(date = today()) {
  const db = await getDb();
  const [p] = await db.select().from(dayPlans).where(eq(dayPlans.date, date));
  return p ?? null;
}

export async function txSince(date: string) {
  const db = await getDb();
  return db.select().from(transactions).where(gte(transactions.date, date)).orderBy(asc(transactions.date));
}
