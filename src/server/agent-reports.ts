import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { opsEvents } from "@/db/schema";

/** Último relato de cada origem na janela; impede repetir cada atualização no bom dia. */
export async function agentReports() {
  const db = await getDb();
  const rows = await db.select().from(opsEvents).where(and(eq(opsEvents.kind, "agente_resumo"), gte(opsEvents.createdAt, new Date(Date.now() - 86_400_000)))).orderBy(desc(opsEvents.createdAt)).limit(100);
  const sources = new Set<string>();
  return rows.filter((row) => { if (sources.has(row.source)) return false; sources.add(row.source); return true; }).slice(0, 12);
}
