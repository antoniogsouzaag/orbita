"use server";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { getDb } from "@/db";
import { opsEvents } from "@/db/schema";
import { MANUALLY_RESOLVABLE_OPS_EVENTS } from "@/lib/ops-events";

export async function resolveIncidentAction(input: { id: string; evidence: string }) {
  await requireAuth();
  const { id, evidence } = z.object({ id: z.uuid(), evidence: z.string().trim().min(10).max(1000) }).parse(input);
  const db = await getDb();
  const now = new Date();
  const rows = await db.update(opsEvents).set({ resolvedAt: now, detail: sql`${opsEvents.detail} || ${JSON.stringify({ resolution: evidence, resolvedBy: "proprietario", resolvedAt: now.toISOString() })}::jsonb` }).where(and(eq(opsEvents.id, id), isNull(opsEvents.resolvedAt), inArray(opsEvents.kind, [...MANUALLY_RESOLVABLE_OPS_EVENTS]))).returning({ id: opsEvents.id });
  revalidatePath("/operacao");
  revalidatePath("/empresa");
  return { resolved: rows.length > 0 };
}
