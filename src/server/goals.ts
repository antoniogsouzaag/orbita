import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { goals, type Goal } from "@/db/schema";

export function goalProgress(g: Pick<Goal, "current" | "target">): number {
  if (!g.target) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(g.current) / Number(g.target)) * 100)));
}

export async function listGoals(status?: string) {
  const db = await getDb();
  return db
    .select()
    .from(goals)
    .where(status ? eq(goals.status, status) : undefined)
    .orderBy(sql`case ${goals.status} when 'ativa' then 0 when 'pausada' then 1 else 2 end`, asc(goals.sort), asc(goals.createdAt));
}
