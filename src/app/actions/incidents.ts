"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { resolveOpsEvent } from "@/server/ops-live";

export async function resolveIncidentAction(input: { id: string; evidence: string }) {
  await requireAuth();
  const { id, evidence } = z.object({ id: z.uuid(), evidence: z.string().trim().min(10).max(1000) }).parse(input);
  const resolved = await resolveOpsEvent(id, evidence, "proprietario");
  revalidatePath("/operacao");
  revalidatePath("/empresa");
  return { resolved };
}
