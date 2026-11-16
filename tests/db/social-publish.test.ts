import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { socialPosts } from "@/db/schema";
import { captionToHtml } from "@/lib/social-postiz";
import { createSocialPost } from "@/server/social-posts";
import { saveSocialMedia } from "@/server/social-media";
import { PostizLimitError, resetPostizBudget, scheduleSocialPost, syncScheduledPosts } from "@/server/social-publish";

const BASE = "https://postiz.test/public/v1";
const GROUP = "8b2560ec-d5c9-4290-9bf7-4b71555ed766";
const channels = ["instagram-standalone", "facebook", "linkedin-page", "threads", "youtube"].map((identifier, i) => ({ id: `ch-${identifier}`, name: `AG LABS ${i}`, identifier, customer: { id: GROUP, name: "AG LABS" } }));
const bytes = new Uint8Array([0xff, 0xd8, 0xff, 1, 2]);
const origin = "https://orb.example";

type Fake = { created: { body: { type: string; date: string; posts: { integration: { id: string } }[] } }[]; uploads: number; createStatus: () => { status: number; headers?: Record<string, string> } | null; remote: unknown[] };
let fake: Fake;
beforeEach(() => {
  vi.stubEnv("POSTIZ_API_URL", BASE);
  vi.stubEnv("POSTIZ_API_KEY", "chave-teste");
  resetPostizBudget();
  fake = { created: [], uploads: 0, createStatus: () => null, remote: [] };
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
    if (url === `${BASE}/integrations`) return json(channels);
    if (url.startsWith(`${BASE}/posts?`)) return json({ posts: fake.remote });
    if (url === `${BASE}/upload`) { fake.uploads++; return json({ id: `up-${fake.uploads}`, path: `https://postiz.test/u/${fake.uploads}.jpg` }); }
    if (url === `${BASE}/posts` && init?.method === "POST") {
      const forced = fake.createStatus();
      if (forced) return new Response("ThrottlerException: Too Many Requests", { status: forced.status, headers: forced.headers });
      fake.created.push({ body: JSON.parse(String(init.body)) });
      return json([{ postId: `pz-${fake.created.length}` }]);
    }
    if (url.startsWith(origin) || url.includes("/redes/aglabs-tela-final.jpg")) return new Response(bytes, { status: 200 });
    throw new Error(`fetch inesperado: ${url}`);
  }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const ready = { brand: "aglabs", network: "instagram", hook: "Seu app pronto em sete dias", caption: "Legenda do post de teste com texto suficiente para comparar.", cta: "Salve o post" };
async function post(format: string, files: [string, string][], extra: Record<string, unknown> = {}) {
  const p = await createSocialPost({ ...ready, format, title: `Agendar ${format} ${Math.random()}`, scheduledAt: new Date(Date.now() + 5 * 86_400_000).toISOString(), ...extra });
  for (const [name, type] of files) await saveSocialMedia({ bytes, filename: name, contentType: type, postId: p.id, origin });
  await (await getDb()).update(socialPosts).set({ stage: "aprovado" }).where(eq(socialPosts.id, p.id));
  return p;
}

describe("agendamento no Postiz", () => {
  it("reel com v1 e v2 sai com um vídeo só, em todas as redes da marca", async () => {
    const p = await post("reels", [["AGLABS-mundos.mp4", "video/mp4"], ["AGLABS-mundos-v2.mp4", "video/mp4"]]);
    const r = await scheduleSocialPost(p.id);
    expect(r.post.stage).toBe("agendado");
    expect(fake.uploads).toBe(1);
    expect(fake.created).toHaveLength(5); // Instagram, Facebook, LinkedIn, Threads, YouTube
    expect(fake.created.every(c => c.body.type === "schedule")).toBe(true);
  });

  it("publicar agora manda type now e grava a hora de agora", async () => {
    const p = await post("imagem", [["capa.jpg", "image/jpeg"]]);
    const r = await scheduleSocialPost(p.id, { modo: "agora" });
    expect(fake.created[0].body.type).toBe("now");
    expect(Math.abs(r.post.scheduledAt!.getTime() - Date.now())).toBeLessThan(60_000);
  });

  it("horário escolhido para hoje é respeitado (sem empurrar para as 20h de outro dia)", async () => {
    const p = await post("imagem", [["capa.jpg", "image/jpeg"]]);
    const when = new Date(Date.now() + 30 * 60_000);
    const r = await scheduleSocialPost(p.id, { modo: "data", quando: when.toISOString() });
    expect(r.post.scheduledAt!.toISOString()).toBe(when.toISOString());
    expect(fake.created[0].body.date).toBe(when.toISOString());
    await expect(scheduleSocialPost((await post("imagem", [["c.jpg", "image/jpeg"]])).id, { modo: "data", quando: new Date(Date.now() + 60_000).toISOString() })).rejects.toThrow(/5 minutos/);
  });

  it("mais de 10 mídias ou dois vídeos param antes de qualquer pedido ao Postiz", async () => {
    const many = await post("carrossel", Array.from({ length: 11 }, (_, i) => [`s-${String(i + 1).padStart(2, "0")}.jpg`, "image/jpeg"] as [string, string]));
    await expect(scheduleSocialPost(many.id)).rejects.toThrow(/11 mídias; o Instagram aceita até 10/);
    const two = await post("reels", [["a.mp4", "video/mp4"], ["b.mp4", "video/mp4"]]);
    await expect(scheduleSocialPost(two.id)).rejects.toThrow(/único vídeo/);
    expect(fake.uploads).toBe(0);
    expect(fake.created).toHaveLength(0);
  });

  it("limite no meio: o Instagram sai, as outras redes ficam anotadas e são retomadas depois", async () => {
    vi.stubEnv("POSTIZ_API_LIMIT", "30");
    const p = await post("imagem", [["capa.jpg", "image/jpeg"]]);
    let calls = 0;
    fake.createStatus = () => (++calls > 2 ? { status: 429, headers: { "retry-after": "1800" } } : null);
    const r = await scheduleSocialPost(p.id);
    expect(r.post.stage).toBe("agendado");
    expect(Object.keys(r.postiz.canais ?? {})).toEqual(["instagram", "facebook"]);
    expect(Object.values(r.postiz.erros ?? {}).every(m => m.startsWith("limite do Postiz"))).toBe(true);
    expect(r.falhas).toHaveLength(2); // LinkedIn e Threads (YouTube não recebe imagem)
    // Durante a pausa, nem tenta: nada novo é criado.
    await expect(scheduleSocialPost(p.id)).rejects.toBeInstanceOf(PostizLimitError);
    resetPostizBudget();
    fake.createStatus = () => null;
    const again = await scheduleSocialPost(p.id);
    expect(Object.keys(again.postiz.canais ?? {}).sort()).toEqual(["facebook", "instagram", "linkedin", "threads"]);
    expect(fake.uploads).toBe(1); // o upload foi reaproveitado
  });

  it("sem espaço para o canal principal: fica Aprovado com o agendamento pendente", async () => {
    const p = await post("imagem", [["capa.jpg", "image/jpeg"]]);
    fake.createStatus = () => ({ status: 429 });
    await expect(scheduleSocialPost(p.id)).rejects.toThrow(/Limite de criação de posts do Postiz/);
    const [row] = await (await getDb()).select().from(socialPosts).where(eq(socialPosts.id, p.id));
    expect(row.stage).toBe("aprovado");
    expect(row.checks.agendamento).toMatchObject({ pendente: true });
  });
});

describe("fechamento", () => {
  it("vincula post que saiu direto pelo Postiz com a mesma legenda e marca publicado", async () => {
    const p = await post("reels", [["AGLABS-mundos-v2.mp4", "video/mp4"]], { caption: "MUNDOS: três mundos, um só agente que trabalha por você enquanto dorme." });
    fake.remote = [
      { id: "outro", state: "PUBLISHED", publishDate: new Date().toISOString(), content: captionToHtml("Post diferente que não tem nada a ver com este aqui."), integration: { id: "ch-instagram-standalone" } },
      { id: "mundos-ig", state: "PUBLISHED", publishDate: new Date().toISOString(), releaseURL: "https://instagram.com/p/xyz", releaseId: "1789", content: captionToHtml("MUNDOS: três mundos, um só agente que trabalha por você enquanto dorme."), integration: { id: "ch-instagram-standalone" } },
      { id: "mundos-fb", state: "PUBLISHED", publishDate: new Date().toISOString(), content: captionToHtml("MUNDOS: três mundos, um só agente que trabalha por você enquanto dorme."), integration: { id: "ch-facebook" } },
    ];
    const r = await syncScheduledPosts();
    expect(r.linked).toBeGreaterThanOrEqual(1);
    const [row] = await (await getDb()).select().from(socialPosts).where(eq(socialPosts.id, p.id));
    expect(row).toMatchObject({ stage: "publicado", publishedUrl: "https://instagram.com/p/xyz" });
    expect(row.checks).toMatchObject({ mediaId: "1789", vinculadoPeloFechamento: true, postiz: { postId: "mundos-ig" } });
  });
});
