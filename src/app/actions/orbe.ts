"use server";

import { z } from "zod";
import { ORBE_MEMORY_SCOPES, type OrbeMemoryScope } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { addMemory, deleteMemoryById, listMemories, MEMORY_LIMITS, updateMemoryById } from "@/server/orbe-memory";

export type MemoryView = { id: string; scope: OrbeMemoryScope; content: string; source: string; updatedAt: string };

/** Blocos visíveis numa tela de espaço: geral + o espaço atual. */
export async function loadMemory(scope: "pessoal" | "empresa") {
  await requireAuth();
  const scopes: OrbeMemoryScope[] = ["geral", z.enum(["pessoal", "empresa"]).parse(scope)];
  const rows = await listMemories(scopes);
  return {
    limits: MEMORY_LIMITS,
    items: rows.map((r): MemoryView => ({ id: r.id, scope: r.scope, content: r.content, source: r.source, updatedAt: r.updatedAt.toISOString() })),
  };
}

const errorMessage = (e: unknown) => (e instanceof z.ZodError ? e.issues.map((i) => i.message).join("; ") : "Não foi possível salvar.");

export async function addMemoryAction(scope: string, content: string) {
  await requireAuth();
  try { return await addMemory(z.enum(ORBE_MEMORY_SCOPES).parse(scope), content, "manual"); } catch (e) { return { ok: false, message: errorMessage(e) }; }
}

export async function updateMemoryAction(id: string, content: string) {
  await requireAuth();
  try { return await updateMemoryById(id, content); } catch (e) { return { ok: false, message: errorMessage(e) }; }
}

export async function deleteMemoryAction(id: string) {
  await requireAuth();
  await deleteMemoryById(id);
  return { ok: true, message: "Anotação removida." };
}
