import { describe, expect, it } from "vitest";
import { createSocialPost } from "@/server/social-posts";
import { getSocialMedia, listPostMedia, saveSocialMedia } from "@/server/social-media";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const origin = "https://orb.example";

describe("mídia dos posts", () => {
  it("guarda, vira capa do post sem mídia e lista", async () => {
    const post = await createSocialPost({ brand: "aglabs", network: "instagram", format: "carrossel", title: "Capa teste" });
    const saved = await saveSocialMedia({ bytes: jpeg, filename: "capa final.jpg", contentType: "image/jpeg", postId: post.id, origin });
    expect(saved.url).toBe(`${origin}/api/redes/midia/${saved.id}`);
    const row = await getSocialMedia(saved.id);
    expect(Buffer.from(row!.data ?? "", "base64")).toEqual(Buffer.from(jpeg));
    expect((await listPostMedia(post.id, origin)).map(m => m.id)).toEqual([saved.id]);
    // segunda mídia sem capa=1 não troca a principal
    const second = await saveSocialMedia({ bytes: jpeg, filename: "slide2.jpg", contentType: "image/jpeg", postId: post.id, origin });
    expect(second.url).not.toBe(saved.url);
  });
  it("recusa tipo, tamanho e post inexistente", async () => {
    await expect(saveSocialMedia({ bytes: jpeg, filename: "x.gif", contentType: "image/gif", origin })).rejects.toThrow();
    await expect(saveSocialMedia({ bytes: new Uint8Array(9 * 1024 * 1024), filename: "x.jpg", contentType: "image/jpeg", origin })).rejects.toThrow(/8 MB/);
    await expect(saveSocialMedia({ bytes: jpeg, filename: "x.jpg", contentType: "image/jpeg", postId: "00000000-0000-4000-8000-000000000000", origin })).rejects.toThrow(/não encontrado/);
  });
  it("id inválido não quebra", async () => expect(await getSocialMedia("nada")).toBeNull());
});

describe("limpeza de mídia", () => {
  it("apaga mídia de post publicado há mais de 7 dias e avulsa antiga; mantém o resto", async () => {
    const { getDb } = await import("@/db");
    const { socialMedia, socialPosts } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const { cleanupSocialMedia } = await import("@/server/social-media");
    const db = await getDb();
    const done = await createSocialPost({ brand: "aglabs", network: "instagram", format: "carrossel", title: "Publicado antigo" });
    const live = await createSocialPost({ brand: "aglabs", network: "instagram", format: "carrossel", title: "Em produção" });
    const old = new Date(Date.now() - 10 * 86_400_000);
    const a = await saveSocialMedia({ bytes: jpeg, filename: "a.jpg", contentType: "image/jpeg", postId: done.id, origin });
    await db.update(socialPosts).set({ stage: "publicado", updatedAt: old }).where(eq(socialPosts.id, done.id));
    const b = await saveSocialMedia({ bytes: jpeg, filename: "b.jpg", contentType: "image/jpeg", postId: live.id, origin });
    const c = await saveSocialMedia({ bytes: jpeg, filename: "c.jpg", contentType: "image/jpeg", origin });
    await db.update(socialMedia).set({ createdAt: old }).where(eq(socialMedia.id, c.id));
    const r = await cleanupSocialMedia();
    expect(r.removed).toBeGreaterThanOrEqual(2);
    expect(await getSocialMedia(a.id)).toBeNull();
    expect(await getSocialMedia(c.id)).toBeNull();
    expect(await getSocialMedia(b.id)).not.toBeNull();
  });
});
