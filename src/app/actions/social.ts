"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import type { SocialStage } from "@/lib/social-pipeline";
import { scheduleSocialPost } from "@/server/social-publish";
import { createSocialPost, deleteSocialPost, duplicateSocialPost, moveSocialPost, updateSocialPost } from "@/server/social-posts";
import type { SocialNetwork } from "@/lib/social-pipeline";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  await requireAuth();
  try { const data = await fn(); revalidatePath("/redes"); return { ok: true, data }; }
  catch (e) { return { ok: false, error: e instanceof Error && !/ZodError/.test(e.name) ? e.message : "Dados inválidos. Revise os campos." }; }
}

export async function createSocialPostAction(raw: unknown) { return run(() => createSocialPost(raw)); }
export async function updateSocialPostAction(id: string, raw: unknown) { return run(() => updateSocialPost(id, raw)); }
/** Aprovar = agendar: depois de aprovado, tenta agendar no Postiz. Se não der, o post fica em Aprovado e o motivo volta. */
export async function moveSocialPostAction(id: string, stage: SocialStage) {
  await requireAuth();
  return run(async () => {
    const moved = await moveSocialPost(id, stage);
    if (stage !== "aprovado") return { post: moved, aviso: null as string | null };
    try {
      const s = await scheduleSocialPost(id);
      const falhas = "falhas" in s ? s.falhas ?? [] : [];
      return { post: s.post, aviso: falhas.length ? `Agendado, mas falhou em: ${falhas.join(", ")}. Abra o post e use "Agendar nas outras redes".` : null };
    }
    catch (e) { return { post: moved, aviso: `Aprovado, mas não agendado no Postiz: ${e instanceof Error ? e.message : "erro"}` }; }
  });
}
export async function scheduleSocialPostAction(id: string) { return run(() => scheduleSocialPost(id)); }
export async function deleteSocialPostAction(id: string) { return run(() => deleteSocialPost(id)); }
export async function duplicateSocialPostAction(id: string, network: SocialNetwork) { return run(() => duplicateSocialPost(id, network)); }
