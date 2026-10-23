import "server-only";
import { asc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { checkins } from "@/db/schema";

export async function getCheckin(date: string) {
  const db = await getDb();
  const [c] = await db.select().from(checkins).where(eq(checkins.date, date));
  return c ?? null;
}

export async function checkinsSince(date: string) {
  const db = await getDb();
  return db.select().from(checkins).where(gte(checkins.date, date)).orderBy(asc(checkins.date));
}
