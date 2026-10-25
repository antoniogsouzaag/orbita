"use server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { proposalReplySchema, saveProposalReply } from "@/server/proposals";

export async function respondToProposal(input: unknown): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireAuth();
  const parsed = proposalReplySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confira o agente e escreva uma resposta de 2 a 4.000 caracteres." };
  try {
    const task = await saveProposalReply(parsed.data);
    revalidatePath("/propostas"); revalidatePath("/empresa"); revalidatePath("/tarefas");
    return { ok: true, id: task.id };
  } catch (error) {
    const known = error instanceof Error && /^(Escolha um agente|Proposta não encontrada|GitHub indisponível|Não foi possível salvar)/.test(error.message);
    return { ok: false, error: known ? (error as Error).message : "Não foi possível salvar a resposta. Seu texto foi preservado; tente novamente." };
  }
}
