"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AGENT_SCOPES } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { createAgentToken, revokeAgentToken, updateAgentScopes } from "@/server/agents";

const CreateSchema = z.object({ name: z.string().trim().min(2).max(60), scopes: z.array(z.enum(AGENT_SCOPES)).min(1) });

/** Cria o token de um agente. O valor só é devolvido aqui, uma única vez. */
export async function createAgentTokenAction(input: { name: string; scopes: string[] }): Promise<{ token: string } | { error: string }> {
  await requireAuth();
  const p = CreateSchema.safeParse(input);
  if (!p.success) return { error: "Informe um nome e pelo menos uma permissão." };
  const token = await createAgentToken(p.data.name, p.data.scopes);
  revalidatePath("/agentes");
  return { token };
}

export async function revokeAgentTokenAction(id: string) {
  await requireAuth();
  await revokeAgentToken(z.string().uuid().parse(id));
  revalidatePath("/agentes");
}

export async function updateAgentProfileAction(id: string, profile: "admin" | "leitura") {
  await requireAuth();
  const tokenId = z.string().uuid().parse(id);
  const role = z.enum(["admin", "leitura"]).parse(profile);
  await updateAgentScopes(tokenId, role === "admin" ? ["admin", "contexto", "status", "tarefas", "eventos"] : ["contexto", "status"]);
  revalidatePath("/agentes");
}
