import { describe, expect, it } from "vitest";
import { createSocialPost } from "@/server/social-posts";
import { getPostLayout, getSocialMedia, listPostMedia, saveSocialMedia } from "@/server/social-media";

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
  it("layout em HTML: guarda limpo, não vira capa e volta o mais recente", async () => {
    const post = await createSocialPost({ brand: "aglabs", network: "instagram", format: "carrossel", title: "Layout teste" });
    expect(await getPostLayout(post.id)).toBeNull();
    const enc = (t: string) => new TextEncoder().encode(t);
    await saveSocialMedia({ bytes: enc(`<div class="slide" id="s1">v1</div>`), filename: "slides.html", contentType: "text/html", postId: post.id, origin, setCover: true });
    const v2 = await saveSocialMedia({ bytes: enc(`<div class="slide" id="s1" onclick="x()">v2<script>alert(1)</script></div>`), filename: "x.html", contentType: "text/html; charset=utf-8", postId: post.id, origin });
    expect(v2.filename).toBe("layout.html");
    const layout = await getPostLayout(post.id);
    expect(layout?.html).toBe(`<div class="slide" id="s1">v2</div>`);
    const { getDb } = await import("@/db");
    const { socialPosts } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await (await getDb()).select({ mediaUrl: socialPosts.mediaUrl }).from(socialPosts).where(eq(socialPosts.id, post.id));
    expect(row.mediaUrl).toBeNull();
  });
});

describe("limpeza de mídia", () => {
  it("segue a retenção por etapa, guarda a capa do publicado, registra e é idempotente", async () => {
    const { getDb } = await import("@/db");
    const { opsEvents, socialMedia, socialPosts } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const { cleanupSocialMedia } = await import("@/server/social-media");
    const db = await getDb();
    const old = new Date(Date.now() - 20 * 86_400_000);
    const mk = async (title: string, stage: string, files: string[], format = "carrossel") => {
      const post = await createSocialPost({ brand: "aglabs", network: "instagram", format, title });
      const media = [];
      for (const f of files) media.push(await saveSocialMedia({ bytes: jpeg, filename: f, contentType: "image/jpeg", postId: post.id, origin }));
      await db.update(socialPosts).set({ stage, updatedAt: old }).where(eq(socialPosts.id, post.id));
      for (const m of media) await db.update(socialMedia).set({ createdAt: old }).where(eq(socialMedia.id, m.id));
      return { post, media };
    };
    const done = await mk("Publicado antigo", "publicado", ["pub-01.jpg", "pub-02.jpg"]);
    const failed = await mk("Falhou antigo", "falhou", ["f-01.jpg"]);
    const draft = await mk("Rascunho com versões", "rascunho", ["r-01.jpg", "r-02.jpg"]);
    const draftV2 = await saveSocialMedia({ bytes: jpeg, filename: "v2-r-02.jpg", contentType: "image/jpeg", postId: draft.post.id, origin });
    // Revisão, aprovado e agendado nunca: nem a versão antiga sai.
    const review = await mk("Em revisão", "revisao", ["rv-01.jpg", "rv-01.jpg"]);
    const scheduled = await mk("Agendado antigo", "agendado", ["ag-01.jpg"]);
    const loose = await saveSocialMedia({ bytes: jpeg, filename: "solta.jpg", contentType: "image/jpeg", origin });
    await db.update(socialMedia).set({ createdAt: old }).where(eq(socialMedia.id, loose.id));

    const dry = await cleanupSocialMedia(new Date(), { simular: true });
    expect(dry.simulado).toBe(true);
    expect(await getSocialMedia(done.media[1].id)).not.toBeNull();

    const r = await cleanupSocialMedia();
    expect(r.motivos).toMatchObject({ publicado: 1, falhou: 1, substituida: 1, avulsa: 1 });
    expect(r.removed).toBe(dry.removed);
    expect(await getSocialMedia(done.media[0].id)).not.toBeNull(); // capa fica de registro
    expect(await getSocialMedia(done.media[1].id)).toBeNull();
    expect(await getSocialMedia(failed.media[0].id)).toBeNull();
    expect(await getSocialMedia(draft.media[1].id)).toBeNull(); // r-02 substituído pelo v2
    expect(await getSocialMedia(draftV2.id)).not.toBeNull();
    expect(await getSocialMedia(draft.media[0].id)).not.toBeNull();
    for (const m of [...review.media, ...scheduled.media]) expect(await getSocialMedia(m.id)).not.toBeNull();
    expect(await getSocialMedia(loose.id)).toBeNull();
    const [archived] = await db.select({ checks: socialPosts.checks }).from(socialPosts).where(eq(socialPosts.id, done.post.id));
    expect(archived.checks.arquivo).toMatchObject({ removidas: 1, arquivos: ["pub-02.jpg"] });
    const events = await db.select().from(opsEvents).where(eq(opsEvents.kind, "midia_limpeza"));
    expect(events.at(-1)?.subject).toMatch(/4 arquivo/);

    const again = await cleanupSocialMedia();
    expect(again.removed).toBe(0);
  });
});

describe("remoção de mídia", () => {
  it("tira a escolhida, as versões antigas e troca a capa quando ela sai", async () => {
    const { removeSocialMedia, postMediaPlan } = await import("@/server/social-media");
    const post = await createSocialPost({ brand: "aglabs", network: "instagram", format: "carrossel", title: "Remover teste" });
    const a = await saveSocialMedia({ bytes: jpeg, filename: "x-01.jpg", contentType: "image/jpeg", postId: post.id, origin });
    const b = await saveSocialMedia({ bytes: jpeg, filename: "x-02.jpg", contentType: "image/jpeg", postId: post.id, origin });
    await saveSocialMedia({ bytes: jpeg, filename: "x-02-v2.jpg", contentType: "image/jpeg", postId: post.id, origin });
    const before = await postMediaPlan(post.id, origin);
    expect(before).toMatchObject({ vao: 2, substituidas: 1 });
    expect(before.midias.find(m => m.id === a.id)).toMatchObject({ uso: "vai", ordem: 1, capa: true });
    expect(before.midias.find(m => m.id === b.id)?.uso).toBe("substituida");

    const old = await removeSocialMedia({ postId: post.id, substituidas: true, origin });
    expect(old.removidas.map(r => r.id)).toEqual([b.id]);
    const cover = await removeSocialMedia({ postId: post.id, ids: [a.id], origin });
    expect(cover.capa).toMatch(/\/api\/redes\/midia\//);
    expect(cover.capa).not.toContain(a.id);
    expect(cover.vao).toBe(1);
    await expect(removeSocialMedia({ postId: post.id, ids: ["00000000-0000-4000-8000-000000000000"], origin })).rejects.toThrow(/não encontrada/);
  });
  it("recusa post que já está no Postiz", async () => {
    const { getDb } = await import("@/db");
    const { socialPosts } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const { removeSocialMedia } = await import("@/server/social-media");
    const post = await createSocialPost({ brand: "aglabs", network: "instagram", format: "carrossel", title: "Já agendado" });
    const a = await saveSocialMedia({ bytes: jpeg, filename: "y-01.jpg", contentType: "image/jpeg", postId: post.id, origin });
    await (await getDb()).update(socialPosts).set({ stage: "agendado" }).where(eq(socialPosts.id, post.id));
    await expect(removeSocialMedia({ postId: post.id, ids: [a.id], origin })).rejects.toThrow(/Postiz/);
  });
});
