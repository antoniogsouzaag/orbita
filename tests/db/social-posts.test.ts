import { describe, expect, it } from "vitest";
import { createSocialPost, deleteSocialPost, listSocialPosts, moveSocialPost, updateSocialPost } from "@/server/social-posts";

const base = { brand: "aglabs", network: "instagram", format: "reels", title: "Teste pipeline" };
const complete = { ...base, hook: "Pare de perder 5h por semana", caption: "Legenda", cta: 'Comente "GUIA"', mediaUrl: "https://cdn.example.com/a.mp4", scheduledAt: "2026-11-02T15:00:00.000Z", checks: { brandReviewed: true, ctaDeliverable: true } };

describe("pipeline de posts", () => {
  it("cria, bloqueia aprovação incompleta e avança quando completo", async () => {
    const post = await createSocialPost(base);
    expect(post.stage).toBe("ideia");
    await expect(moveSocialPost(post.id, "aprovado")).rejects.toThrow(/Falta para aprovar/);
    await updateSocialPost(post.id, complete);
    expect((await moveSocialPost(post.id, "agendado")).stage).toBe("agendado");
    // Editar post agendado não pode remover requisito obrigatório.
    await expect(updateSocialPost(post.id, { ...complete, hook: "" })).rejects.toThrow(/Gancho/);
    expect((await listSocialPosts()).some(p => p.id === post.id)).toBe(true);
    await deleteSocialPost(post.id);
    expect((await listSocialPosts()).some(p => p.id === post.id)).toBe(false);
  });
  it("rejeita link não http", async () => {
    await expect(createSocialPost({ ...base, mediaUrl: "javascript:alert(1)" })).rejects.toThrow();
  });
});
import { duplicateSocialPost } from "@/server/social-posts";
describe("adaptação", () => {
  it("duplica para outra rede em rascunho sem herdar revisão", async () => {
    const post = await createSocialPost({ ...complete });
    const copy = await duplicateSocialPost(post.id, "tiktok");
    expect(copy).toMatchObject({ network: "tiktok", stage: "rascunho", hook: complete.hook, checks: {} });
  });
});
