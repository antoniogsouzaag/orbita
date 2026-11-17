"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { resolveOpsEvent } from "@/server/ops-live";
import { n8nOverview } from "@/server/ops";
import { resolveVerifiedWorkflowFailure } from "@/server/workflow-failures";

function refreshIncidents() {
  revalidatePath("/operacao");
  revalidatePath("/operacao/automacoes");
  revalidatePath("/empresa");
}

export async function resolveIncidentAction(input: { id: string; evidence: string }) {
  await requireAuth();
  const { id, evidence } = z.object({ id: z.uuid(), evidence: z.string().trim().min(10).max(1000) }).parse(input);
  const resolved = await resolveOpsEvent(id, evidence, "proprietario");
  refreshIncidents();
  return { resolved };
}

export async function resolveWorkflowFailureAction(input: { url: string; evidence: string }) {
  await requireAuth();
  const { url, evidence } = z.object({ url: z.url().max(2000), evidence: z.string().trim().min(10).max(1000) }).parse(input);
  // A URL do cliente nunca é buscada: somente as instâncias configuradas são consultadas.
  const overview = await n8nOverview();
  const execution = overview.instances.flatMap(i => i.errors).find(e => e.url === url);
  if (!execution) throw new Error("Execução não disponível para conferência no n8n. Atualize a página.");
  const resolved = await resolveVerifiedWorkflowFailure(execution, evidence);
  refreshIncidents();
  return { resolved };
}
