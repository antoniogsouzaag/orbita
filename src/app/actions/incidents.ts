"use server";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { getDb } from "@/db";
import { opsEvents } from "@/db/schema";

export async function resolveIncidentAction(input: { id: string; evidence: string }) {
  await requireAuth();
  const { id, evidence } = z.object({ id: z.uuid(), evidence: z.string().trim().min(10).max(1000) }).parse(input);
  const db = await getDb();
  const now = new Date();
  await db.update(opsEvents).set({ resolvedAt: now, detail: sql`${opsEvents.detail} || ${JSON.stringify({ resolution: evidence, resolvedBy: "proprietario", resolvedAt: now.toISOString() })}::jsonb` }).where(and(eq(opsEvents.id, id), isNull(opsEvents.resolvedAt), eq(opsEvents.kind, "workflow_error")));
  revalidatePath("/operacao");
  revalidatePath("/empresa");
}
