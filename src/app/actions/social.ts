"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import type { SocialStage } from "@/lib/social-pipeline";
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
export async function moveSocialPostAction(id: string, stage: SocialStage) { return run(() => moveSocialPost(id, stage)); }
export async function deleteSocialPostAction(id: string) { return run(() => deleteSocialPost(id)); }
export async function duplicateSocialPostAction(id: string, network: SocialNetwork) { return run(() => duplicateSocialPost(id, network)); }
