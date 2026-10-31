import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { socialMedia, socialPosts, type SocialPost } from "@/db/schema";
import { buildSchedulePayload, orderMedia, pickChannel, type PostizChannel, type PostizMedia } from "@/lib/social-postiz";
import { stageError, type SocialBrand, type SocialNetwork } from "@/lib/social-pipeline";
import { getSocialMedia } from "./social-media";

/* ───────────── cliente da API pública do Postiz (mesma configuração da aba Métricas) ───────────── */

function base() {
  const url = process.env.POSTIZ_API_URL, key = process.env.POSTIZ_API_KEY;
  if (!url || !key) throw new Error("Postiz não configurado (POSTIZ_API_URL / POSTIZ_API_KEY).");
  return { url: url.replace(/\/$/, ""), key };
}
async function postiz<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = base();
  const res = await fetch(`${url}${path}`, { ...init, headers: { Authorization: key, "user-agent": "orbita", accept: "application/json", ...init.headers }, signal: AbortSignal.timeout(60_000), cache: "no-store", redirect: "error" });
  const text = await res.text();
  if (!res.ok) throw new Error(`Postiz respondeu ${res.status}: ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : null) as T;
}

/** Sobe um arquivo da Órbita para o Postiz (toda mídia precisa passar pelo upload antes do post). */
async function uploadToPostiz(mediaId: string): Promise<PostizMedia> {
  const row = await getSocialMedia(mediaId);
  if (!row) throw new Error("Mídia do post não encontrada.");
  let bytes: Uint8Array;
  if (row.data) bytes = Buffer.from(row.data, "base64");
  else if (row.publicUrl) {
    const res = await fetch(row.publicUrl, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Não consegui ler ${row.filename} do storage (${res.status}).`);
    bytes = new Uint8Array(await res.arrayBuffer());
  } else throw new Error(`Arquivo ${row.filename} fora do armazenamento configurado.`);
  const form = new FormData();
  form.set("file", new Blob([Buffer.from(bytes)], { type: row.contentType }), row.filename);
  const out = await postiz<{ id?: string; path?: string }>("/upload", { method: "POST", body: form });
  if (!out?.id || !out.path) throw new Error(`Upload de ${row.filename} sem id/path.`);
  return { id: out.id, path: out.path };
}

type PostizState = { postId: string; integrationId: string; scheduledFor: string; at: string };
const postizOf = (p: Pick<SocialPost, "checks">) => (p.checks as { postiz?: PostizState } | null)?.postiz ?? null;

/**
 * Aprovar = agendar. Valida as mesmas regras de "agendado" (checklist, data e entregas do CTA), sobe as mídias,
 * cria o post no canal da marca e muda a etapa para Agendado. Idempotente: post que já tem id do Postiz não é recriado.
 */
export async function scheduleSocialPost(id: string) {
  const db = await getDb();
  const [post] = await db.select().from(socialPosts).where(eq(socialPosts.id, id));
  if (!post) throw new Error("Post não encontrado.");
  const existing = postizOf(post);
  if (existing) return { post, postiz: existing, already: true };
  const error = stageError({ ...post, network: post.network as SocialNetwork }, "agendado");
  if (error) throw new Error(error);
  if (!post.caption?.trim()) throw new Error("Legenda vazia.");
  if (post.scheduledAt!.getTime() <= Date.now() + 5 * 60_000) throw new Error("A data do post já passou (ou é em menos de 5 minutos). Ajuste a data.");

  const channels = await postiz<PostizChannel[]>("/integrations");
  const channel = pickChannel(channels, post.brand as SocialBrand, post.network as SocialNetwork);
  if (!channel) throw new Error(`Nenhum canal ativo de ${post.brand} no ${post.network} no Postiz.`);

  // Mídias do post na ordem do carrossel; o mesmo nome enviado de novo vale a versão mais recente.
  const all = await db.select({ id: socialMedia.id, filename: socialMedia.filename, contentType: socialMedia.contentType, createdAt: socialMedia.createdAt }).from(socialMedia).where(eq(socialMedia.postId, post.id));
  // Reel/vídeo vai só com o vídeo (a capa em JPG viraria carrossel); carrossel e imagem vão só com imagens.
  const wantsVideo = post.format === "reels" || post.format === "video";
  const rows = all.filter(r => r.contentType.startsWith("video/") === wantsVideo);
  if (wantsVideo && rows.length !== 1) throw new Error(rows.length ? "Reel precisa de um único vídeo." : "Envie o MP4 do reel antes de aprovar.");
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) { const cur = latest.get(r.filename); if (!cur || cur.createdAt < r.createdAt) latest.set(r.filename, r); }
  const ordered = orderMedia([...latest.values()]);
  if (!ordered.length) throw new Error("Envie a capa e as mídias do post antes de aprovar.");
  if (ordered.length > 10) throw new Error(`${ordered.length} mídias; o Instagram aceita até 10.`);

  const media: PostizMedia[] = [];
  for (const m of ordered) media.push(await uploadToPostiz(m.id));
  const payload = buildSchedulePayload({ channel, caption: post.caption!, media, date: post.scheduledAt!, title: post.title });
  const result = await postiz<Array<{ postId?: string; id?: string }>>("/posts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const postId = result?.[0]?.postId ?? result?.[0]?.id;
  if (!postId) throw new Error("O Postiz não devolveu o id do post.");
  const state: PostizState = { postId, integrationId: channel.id, scheduledFor: post.scheduledAt!.toISOString(), at: new Date().toISOString() };
  const [row] = await db.update(socialPosts).set({ stage: "agendado", checks: { ...post.checks, postiz: state }, updatedAt: new Date() }).where(eq(socialPosts.id, post.id)).returning();
  return { post: row, postiz: state, already: false };
}

type RemotePost = { id: string; state?: string; publishDate?: string; releaseURL?: string | null; releaseId?: string | null; error?: string | null };

/** Fechamento: posts agendados que o Postiz já publicou viram Publicado com link e media_id; erro vira Falhou. */
export async function syncScheduledPosts(now = new Date()) {
  const db = await getDb();
  const scheduled = (await db.select().from(socialPosts).where(eq(socialPosts.stage, "agendado"))).filter(p => postizOf(p));
  if (!scheduled.length) return { checked: 0, published: 0, failed: 0 };
  const times = scheduled.map(p => new Date(postizOf(p)!.scheduledFor).getTime());
  const start = new Date(Math.min(...times) - 86_400_000).toISOString(), end = new Date(Math.max(...times, now.getTime()) + 86_400_000).toISOString();
  const list = await postiz<{ posts?: RemotePost[] } | RemotePost[]>(`/posts?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`);
  const remote = new Map((Array.isArray(list) ? list : list?.posts ?? []).map(r => [r.id, r]));
  let published = 0, failed = 0;
  for (const p of scheduled) {
    const r = remote.get(postizOf(p)!.postId);
    if (r?.state === "PUBLISHED") {
      published++;
      await db.update(socialPosts).set({ stage: "publicado", publishedUrl: r.releaseURL ?? p.publishedUrl, checks: { ...p.checks, mediaId: r.releaseId ?? p.checks?.mediaId ?? null }, updatedAt: new Date() })
        .where(and(eq(socialPosts.id, p.id), eq(socialPosts.stage, "agendado")));
    } else if (r?.state === "ERROR") {
      failed++;
      await db.update(socialPosts).set({ stage: "falhou", notes: `${p.notes ?? ""}\n\n[Postiz ${now.toISOString().slice(0, 16)}] falhou ao publicar${r.error ? `: ${r.error}` : ""}.`.trim(), updatedAt: new Date() })
        .where(and(eq(socialPosts.id, p.id), eq(socialPosts.stage, "agendado")));
    }
  }
  return { checked: scheduled.length, published, failed };
}
