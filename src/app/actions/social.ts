"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAuth } from "@/lib/auth";
import type { SocialStage } from "@/lib/social-pipeline";
import { externalSocialPosts, PostizLimitError, scheduleSocialPost, syncScheduledPosts, type ScheduleOptions } from "@/server/social-publish";
import { createSocialPost, deleteSocialPost, requestSocialAdjustment, duplicateSocialPost, moveSocialPost, updateSocialPost } from "@/server/social-posts";
import type { SocialNetwork } from "@/lib/social-pipeline";
import { getPostLayout, postMediaIssues, removeSocialMedia } from "@/server/social-media";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  await requireAuth();
  try { const data = await fn(); revalidatePath("/redes"); revalidateTag("postiz-external", { expire: 0 }); return { ok: true, data }; }
  catch (e) { return { ok: false, error: e instanceof Error && !/ZodError/.test(e.name) ? e.message : "Dados inválidos. Revise os campos." }; }
}

const origin = () => process.env.ORBITA_PUBLIC_URL ?? "https://orb.aglabs.api.br";
const limitNotice = (e: PostizLimitError) => `Aprovado. ${e.message} O agendamento ficou pendente: o fechamento da noite tenta de novo, ou use "Agendar no Postiz" depois.`;

export async function createSocialPostAction(raw: unknown) { return run(() => createSocialPost(raw)); }
export async function updateSocialPostAction(id: string, raw: unknown) { return run(() => updateSocialPost(id, raw)); }
/**
 * Aprovar = agendar: depois de aprovado, tenta agendar no Postiz. Se não der, o post fica em Aprovado e o motivo volta.
 * `opts.modo`: auto (regra das 20h), data (horário escolhido) ou agora (publica já).
 */
export async function moveSocialPostAction(id: string, stage: SocialStage, opts: ScheduleOptions = {}) {
  await requireAuth();
  return run(async () => {
    if (stage === "aprovado") {
      // Bloqueios que o Postiz recusaria: nem aprova, para o post não ficar parado em Aprovado.
      const issues = await postMediaIssues(id);
      if (issues.length) throw new Error(`Falta para aprovar: ${issues.join(" ")}`);
      if (opts.modo === "data" && (!opts.quando || new Date(opts.quando).getTime() < Date.now() + 5 * 60_000)) throw new Error("Escolha um horário daqui a pelo menos 5 minutos, ou use Publicar agora.");
    }
    const moved = await moveSocialPost(id, stage);
    if (stage !== "aprovado") return { post: moved, aviso: null as string | null };
    try {
      const s = await scheduleSocialPost(id, opts);
      return { post: s.post, aviso: s.falhas.length ? `Agendado no Instagram; ficou para depois: ${s.falhas.join(", ")}. Abra o post e use "Agendar nas outras redes".` : null };
    }
    catch (e) { return { post: moved, aviso: e instanceof PostizLimitError ? limitNotice(e) : `Aprovado, mas não agendado no Postiz: ${e instanceof Error ? e.message : "erro"}` }; }
  });
}
export async function scheduleSocialPostAction(id: string, opts: ScheduleOptions = {}) { return run(() => scheduleSocialPost(id, opts)); }
export async function requestSocialAdjustmentAction(id: string, nota: string) { return run(() => requestSocialAdjustment(id, nota)); }
export async function deleteSocialPostAction(id: string) { return run(() => deleteSocialPost(id)); }
export async function duplicateSocialPostAction(id: string, network: SocialNetwork) { return run(() => duplicateSocialPost(id, network)); }
/** Tira mídias do post: as escolhidas ou todas as versões antigas. */
export async function removeSocialMediaAction(postId: string, ids: string[], substituidas = false) { return run(() => removeSocialMedia({ postId, ids, substituidas, origin: origin() })); }
/** Fechamento sob demanda: confere no Postiz o que já saiu, inclusive post publicado direto por lá. */
export async function syncSocialPostsAction() { return run(() => syncScheduledPosts()); }
/** Conciliação sob demanda: só roda quando o calendário/hoje é aberto (ou no botão Atualizar). */
export async function externalSocialPostsAction(force = false) { await requireAuth(); try { return { ok: true as const, data: await externalSocialPosts(force) }; } catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : "Postiz indisponível" }; } }
/** Abre o layout do post no editor. Só leitura: o HTML salvo volta pelo upload de mídia. */
export async function socialLayoutAction(postId: string) { await requireAuth(); try { return { ok: true as const, data: await getPostLayout(postId) }; } catch (e) { return { ok: false as const, error: e instanceof Error && e.name !== "ZodError" ? e.message : "Post inválido." }; } }
