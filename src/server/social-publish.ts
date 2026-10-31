import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { socialMedia, socialPosts, type SocialPost } from "@/db/schema";
import { buildSchedulePayload, captionFor, fanoutNetworks, orderMedia, pickChannel, type PostizChannel, type PostizMedia } from "@/lib/social-postiz";
import { NETWORK_LABELS, nextFreeSlot, stageError, type SocialBrand, type SocialNetwork } from "@/lib/social-pipeline";
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

type PostizChannelState = { postId: string; integrationId: string };
/** postId/integrationId = canal principal (Instagram), usado no fechamento. canais = todas as redes já agendadas. */
type PostizState = { postId: string; integrationId: string; scheduledFor: string; at: string; canais?: Record<string, PostizChannelState>; erros?: Record<string, string> };

/** Tela final das outras redes (sem automação de palavra-chave): substitui o último slide fora do Instagram. */
const FINAL_SCREEN: Partial<Record<SocialBrand, string>> = { aglabs: "/redes/aglabs-tela-final.jpg" };
async function uploadFinalScreen(brand: SocialBrand): Promise<PostizMedia | null> {
  const path = FINAL_SCREEN[brand];
  if (!path) return null;
  const origin = process.env.ORBITA_PUBLIC_URL ?? "https://orb.aglabs.api.br";
  const res = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Tela final indisponível (${res.status}).`);
  const form = new FormData();
  form.set("file", new Blob([Buffer.from(await res.arrayBuffer())], { type: "image/jpeg" }), path.split("/").pop()!);
  const out = await postiz<{ id?: string; path?: string }>("/upload", { method: "POST", body: form });
  if (!out?.id || !out.path) throw new Error("Upload da tela final sem id/path.");
  return { id: out.id, path: out.path };
}
const postizOf = (p: Pick<SocialPost, "checks">) => (p.checks as { postiz?: PostizState } | null)?.postiz ?? null;

/**
 * Aprovar = agendar. Valida as mesmas regras de "agendado" (checklist, data e entregas do CTA), sobe as mídias,
 * cria o post no canal da marca e muda a etapa para Agendado. Idempotente: post que já tem id do Postiz não é recriado.
 */
type RemotePostSummary = { id: string; state?: string; publishDate?: string; integration?: { id?: string } | null; integrationId?: string; deletedAt?: string | null };
/** Posts do canal no Postiz nos próximos 60 dias, no formato que nextFreeSlot entende. Falha de leitura não bloqueia (conta só o Órbita). */
async function occupiedInPostiz(integrationId: string, brand: string) {
  try {
    const start = new Date(Date.now() - 86_400_000).toISOString(), end = new Date(Date.now() + 60 * 86_400_000).toISOString();
    const list = await postiz<{ posts?: RemotePostSummary[] } | RemotePostSummary[]>(`/posts?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`);
    return (Array.isArray(list) ? list : list?.posts ?? [])
      .filter(r => (r.integration?.id ?? r.integrationId) === integrationId && r.publishDate && r.state !== "ERROR" && !r.deletedAt)
      .map(r => ({ id: `postiz:${r.id}`, brand, stage: "agendado", scheduledAt: new Date(r.publishDate!) }));
  } catch { return []; }
}

export async function scheduleSocialPost(id: string) {
  const db = await getDb();
  const [post] = await db.select().from(socialPosts).where(eq(socialPosts.id, id));
  if (!post) throw new Error("Post não encontrado.");
  const existing = postizOf(post);
  const wantsVideo = post.format === "reels" || post.format === "video";
  const networks = fanoutNetworks(post.brand as SocialBrand, post.network as SocialNetwork, wantsVideo);
  const done: Record<string, PostizChannelState> = existing ? { [post.network]: { postId: existing.postId, integrationId: existing.integrationId }, ...existing.canais } : {};
  if (existing && networks.every(n => done[n] || existing.erros?.[n] === "sem canal")) return { post, postiz: existing, already: true };
  const channels = await postiz<PostizChannel[]>("/integrations");
  const channel = pickChannel(channels, post.brand as SocialBrand, post.network as SocialNetwork);
  if (!channel) throw new Error(`Nenhum canal ativo de ${post.brand} no ${post.network} no Postiz.`);

  // Data passada, muito em cima ou dia já ocupado por outro post da marca: vai para o próximo dia livre às 20h.
  const proprios = await db.select({ id: socialPosts.id, brand: socialPosts.brand, stage: socialPosts.stage, scheduledAt: socialPosts.scheduledAt }).from(socialPosts);
  // Dias já ocupados no Postiz pelo mesmo canal (posts criados fora do Órbita, como os do pipeline antigo) também contam.
  const outros = [...proprios, ...(await occupiedInPostiz(channel.id, post.brand))];
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const clash = post.scheduledAt && outros.some(o => o.id !== post.id && o.brand === post.brand && o.stage !== "falhou" && o.scheduledAt && day(o.scheduledAt) === day(post.scheduledAt!));
  if (existing) post.scheduledAt = new Date(existing.scheduledFor);
  else if (!post.scheduledAt || post.scheduledAt.getTime() < Date.now() + 2 * 3_600_000 || clash) {
    const slot = nextFreeSlot(outros, post.brand, new Date(), post.id);
    await db.update(socialPosts).set({ scheduledAt: slot }).where(eq(socialPosts.id, post.id));
    post.scheduledAt = slot;
  }
  const error = stageError({ ...post, network: post.network as SocialNetwork }, "agendado");
  if (error) throw new Error(error);
  // Quem comentar recebe o link: a página precisa estar no ar antes de o post sair.
  const page = post.checks?.keyword ? post.checks?.pageUrl : null;
  if (page) {
    const st = await fetch(page, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(10_000) }).then(r => r.status, () => 0);
    if (st !== 200) throw new Error(`A página gratuita ainda não está no ar (${page} respondeu ${st || "sem resposta"}).`);
  }

  // Mídias do post na ordem do carrossel; o mesmo nome enviado de novo vale a versão mais recente.
  const all = await db.select({ id: socialMedia.id, filename: socialMedia.filename, contentType: socialMedia.contentType, createdAt: socialMedia.createdAt }).from(socialMedia).where(eq(socialMedia.postId, post.id));
  // Reel/vídeo vai só com o vídeo (a capa em JPG viraria carrossel); carrossel e imagem vão só com imagens.
  const rows = all.filter(r => r.contentType.startsWith("video/") === wantsVideo);
  if (wantsVideo && rows.length !== 1) throw new Error(rows.length ? "Reel precisa de um único vídeo." : "Envie o MP4 do reel antes de aprovar.");
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) { const cur = latest.get(r.filename); if (!cur || cur.createdAt < r.createdAt) latest.set(r.filename, r); }
  const ordered = orderMedia([...latest.values()]);
  if (!ordered.length) throw new Error("Envie a capa e as mídias do post antes de aprovar.");
  if (ordered.length > 10) throw new Error(`${ordered.length} mídias; o Instagram aceita até 10.`);

  const media: PostizMedia[] = [];
  for (const m of ordered) media.push(await uploadToPostiz(m.id));
  // Fora do Instagram não há automação da palavra-chave: o último slide (CTA "comenta X") vira a tela final.
  const keyword = post.checks?.keyword;
  const needsFinal = Boolean(keyword) && !wantsVideo && media.length > 1 && networks.some(n => n !== "instagram" && !done[n]);
  const finalScreen = needsFinal ? await uploadFinalScreen(post.brand as SocialBrand).catch(() => null) : null;

  const erros: Record<string, string> = {};
  for (const network of networks) {
    if (done[network]) continue;
    const ch = network === post.network ? channel : pickChannel(channels, post.brand as SocialBrand, network);
    if (!ch) { erros[network] = "sem canal"; continue; }
    const { content, comment } = captionFor(network, post.caption!, { pageUrl: keyword ? post.checks?.pageUrl : null });
    const files = network !== "instagram" && finalScreen ? [...media.slice(0, -1), finalScreen] : media;
    try {
      const payload = buildSchedulePayload({ channel: ch, caption: content, comment, media: files, date: post.scheduledAt!, title: post.title, isVideo: wantsVideo });
      const result = await postiz<Array<{ postId?: string; id?: string }>>("/posts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const postId = result?.[0]?.postId ?? result?.[0]?.id;
      if (!postId) throw new Error("o Postiz não devolveu o id do post");
      done[network] = { postId, integrationId: ch.id };
    } catch (e) {
      // O canal principal precisa sair; os outros ficam anotados e são tentados de novo no próximo "Agendar no Postiz".
      if (network === post.network) throw e;
      erros[network] = e instanceof Error ? e.message.slice(0, 200) : "falhou";
    }
  }
  const main = done[post.network];
  const state: PostizState = { postId: main.postId, integrationId: main.integrationId, scheduledFor: post.scheduledAt!.toISOString(), at: existing?.at ?? new Date().toISOString(), canais: done, ...(Object.keys(erros).length ? { erros } : {}) };
  const falhas = Object.entries(erros).filter(([, m]) => m !== "sem canal").map(([n]) => NETWORK_LABELS[n as SocialNetwork] ?? n);
  const [row] = await db.update(socialPosts).set({ stage: "agendado", checks: { ...post.checks, postiz: state }, updatedAt: new Date() }).where(eq(socialPosts.id, post.id)).returning();
  return { post: row, postiz: state, already: false, falhas };
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
