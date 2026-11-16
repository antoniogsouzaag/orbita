import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { revalidateTag, unstable_cache } from "next/cache";
import { getDb } from "@/db";
import { socialMedia, socialPosts, type SocialPost } from "@/db/schema";
import { retryAfterMs } from "@/lib/rate-window";
import { clearPostizBudget, createBudget, loadPostizBudget, POSTIZ_POST_LIMIT, postizBudget, savePostizBudget } from "./postiz-budget";
import { buildSchedulePayload, captionFor, channelIdentity, fanoutNetworks, isVideoFormat, mediaForNetwork, pickChannel, planMedia, reconcileExternal, sameCaption, type PostizChannel, type PostizMedia, type RemoteListedPost } from "@/lib/social-postiz";
import { NETWORK_LABELS, nextFreeSlot, stageError, type SocialBrand, type SocialChecks, type SocialNetwork } from "@/lib/social-pipeline";
import { getSocialMedia } from "./social-media";
import { invalidateDeliveries } from "./social-deliveries";

/* ───────────── cliente da API pública do Postiz (mesma configuração da aba Métricas) ───────────── */

// Janela de criações de post (limite do Postiz): regra e motivo em ./postiz-budget.
export { postizBudget };
/** Só para os testes. */
export async function resetPostizBudget() { await clearPostizBudget(); channelCache = null; occupiedCache.clear(); }

const hhmm = (t: number) => new Date(t).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
/** O Postiz pediu pausa (429) ou a conta de criações da hora já fechou. `until` = quando dá para tentar de novo. */
export class PostizLimitError extends Error {
  constructor(readonly until: number | null, detail?: string) {
    super(`Limite de criação de posts do Postiz (${POSTIZ_POST_LIMIT} por hora)${detail ? `: ${detail}` : ""}.${until ? ` Libera por volta de ${hhmm(until)}.` : ""}`);
    this.name = "PostizLimitError";
  }
}

function base() {
  const url = process.env.POSTIZ_API_URL, key = process.env.POSTIZ_API_KEY;
  if (!url || !key) throw new Error("Postiz não configurado (POSTIZ_API_URL / POSTIZ_API_KEY).");
  return { url: url.replace(/\/$/, ""), key };
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
/** Espera curta (até 20 s) é repetida aqui mesmo; espera longa vira PostizLimitError para o post ficar pendente. */
const SHORT_WAIT_MS = 20_000;
async function postiz<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = base();
  const counts = init.method === "POST" && path === "/posts";
  for (let attempt = 0; ; attempt++) {
    if (counts) {
      const blocked = createBudget.state().blockedUntil;
      if (blocked) throw new PostizLimitError(blocked, "o Postiz pediu uma pausa");
      createBudget.record();
    }
    const res = await fetch(`${url}${path}`, { ...init, headers: { Authorization: key, "user-agent": "orbita", accept: "application/json", ...init.headers }, signal: AbortSignal.timeout(60_000), cache: "no-store", redirect: "error" });
    const text = await res.text();
    if (res.status === 429) {
      const wait = retryAfterMs(res.headers);
      if (wait !== null && wait <= SHORT_WAIT_MS && attempt < 2) { await sleep(Math.max(wait, 1_000)); continue; }
      // Sem prazo informado: o limite é por hora, então a próxima tentativa razoável é em 15 min.
      const until = Date.now() + (wait ?? 15 * 60_000);
      if (counts) createBudget.block(until);
      throw new PostizLimitError(until, /Throttler/i.test(text) ? "ThrottlerException" : "HTTP 429");
    }
    if (!res.ok) throw new Error(`Postiz respondeu ${res.status}: ${text.slice(0, 200)}`);
    return (text ? JSON.parse(text) : null) as T;
  }
}

/** Canais mudam raramente: 10 min de memória poupam uma chamada por aprovação. */
let channelCache: { at: number; list: PostizChannel[] } | null = null;
async function postizChannels() {
  if (channelCache && Date.now() - channelCache.at < 600_000) return channelCache.list;
  const list = await postiz<PostizChannel[]>("/integrations");
  channelCache = { at: Date.now(), list };
  return list;
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
/**
 * postId/integrationId = canal principal (Instagram), usado no fechamento. canais = todas as redes já agendadas.
 * midias = uploads já feitos (id da mídia na Órbita → arquivo no Postiz), reaproveitados quando uma rede é tentada de novo.
 */
type PostizState = { postId: string; integrationId: string; scheduledFor: string; at: string; canais?: Record<string, PostizChannelState>; erros?: Record<string, string>; midias?: Record<string, PostizMedia>; agora?: boolean };

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
/** Carrossel com vídeo fica só no Instagram: as outras redes são puladas de propósito, sem contar como falha. */
const SEM_IMAGEM = "carrossel com vídeo: publicado só no Instagram";
/** Rede deixada para depois por causa do limite do Postiz: entra de novo no "Agendar nas outras redes" e no fechamento. */
const LIMITE = "limite do Postiz";
const SKIPPED = (m?: string) => m === "sem canal" || m === SEM_IMAGEM;
const postizOf = (p: Pick<SocialPost, "checks">) => (p.checks as { postiz?: PostizState } | null)?.postiz ?? null;

type RemotePostSummary = { id: string; state?: string; publishDate?: string; integration?: { id?: string } | null; integrationId?: string; deletedAt?: string | null };
/** Posts do canal no Postiz nos próximos 60 dias, no formato que nextFreeSlot entende. Falha de leitura não bloqueia (conta só o Órbita). */
const occupiedCache = new Map<string, { at: number; list: { id: string; brand: string; stage: string; scheduledAt: Date }[] }>();
async function occupiedInPostiz(integrationId: string, brand: string) {
  const hit = occupiedCache.get(integrationId);
  if (hit && Date.now() - hit.at < 600_000) return hit.list;
  try {
    const start = new Date(Date.now() - 86_400_000).toISOString(), end = new Date(Date.now() + 60 * 86_400_000).toISOString();
    const list = await postiz<{ posts?: RemotePostSummary[] } | RemotePostSummary[]>(`/posts?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`);
    const out = (Array.isArray(list) ? list : list?.posts ?? [])
      .filter(r => (r.integration?.id ?? r.integrationId) === integrationId && r.publishDate && r.state !== "ERROR" && !r.deletedAt)
      .map(r => ({ id: `postiz:${r.id}`, brand, stage: "agendado", scheduledAt: new Date(r.publishDate!) }));
    occupiedCache.set(integrationId, { at: Date.now(), list: out });
    return out;
  } catch { return []; }
}

/**
 * Quando sai: `auto` = data do post se ainda faltam 2 h e o dia está livre, senão o próximo dia livre às 20h;
 * `data` = exatamente `quando` (ou a data do post), sem trocar de dia, desde que daqui a 5 min ou mais;
 * `agora` = o Postiz publica assim que recebe.
 */
export type ScheduleMode = "auto" | "agora" | "data";
export type ScheduleOptions = { modo?: ScheduleMode; quando?: string | null };
const MIN_LEAD_MS = 5 * 60_000;

/**
 * Aprovar = agendar. Valida as mesmas regras de "agendado" (checklist, data e entregas do CTA), sobe as mídias,
 * cria o post no canal da marca e muda a etapa para Agendado. Idempotente: rede que já tem id do Postiz não é recriada.
 * Se o limite do Postiz acabar no meio, o canal principal sai e as outras redes ficam anotadas para depois;
 * se nem o principal couber, o post fica em Aprovado com o agendamento pendente (o fechamento tenta de novo).
 */
export async function scheduleSocialPost(id: string, opts: ScheduleOptions = {}) {
  const db = await getDb();
  const [post] = await db.select().from(socialPosts).where(eq(socialPosts.id, id));
  if (!post) throw new Error("Post não encontrado.");
  // A conta de criações vem do banco (sobrevive a deploy) e volta para lá no fim, deu certo ou não.
  await loadPostizBudget();
  try { return await schedule(post, opts); }
  catch (e) {
    // Limite do Postiz antes de o canal principal sair: aprovado, com o pedido guardado para a próxima tentativa.
    if (e instanceof PostizLimitError && !postizOf(post)) {
      const agendamento: SocialChecks["agendamento"] = { pendente: true, motivo: e.message, at: new Date().toISOString(), modo: opts.modo ?? "auto" };
      await db.update(socialPosts).set({ checks: { ...post.checks, agendamento } }).where(eq(socialPosts.id, post.id));
    }
    throw e;
  }
  finally { await savePostizBudget(); }
}

async function schedule(post: SocialPost, opts: ScheduleOptions) {
  const db = await getDb();
  const modo = opts.modo ?? "auto";
  const existing = postizOf(post);
  const wantsVideo = isVideoFormat(post.format);
  const networks = fanoutNetworks(post.brand as SocialBrand, post.network as SocialNetwork, wantsVideo);
  const done: Record<string, PostizChannelState> = existing ? { [post.network]: { postId: existing.postId, integrationId: existing.integrationId }, ...existing.canais } : {};
  if (existing && networks.every(n => done[n] || SKIPPED(existing.erros?.[n]))) return { post, postiz: existing, already: true, falhas: [] as string[] };
  const channels = await postizChannels();
  const channel = pickChannel(channels, post.brand as SocialBrand, post.network as SocialNetwork);
  if (!channel) throw new Error(`Nenhum canal ativo de ${post.brand} no ${post.network} no Postiz.`);

  const now = Date.now();
  if (existing) post.scheduledAt = new Date(existing.scheduledFor);
  else if (modo === "agora") post.scheduledAt = new Date(now);
  else if (modo === "data") {
    const when = opts.quando ? new Date(opts.quando) : post.scheduledAt;
    if (!when || Number.isNaN(when.getTime())) throw new Error("Escolha a data e a hora de publicação.");
    if (when.getTime() < now + MIN_LEAD_MS) throw new Error("Escolha um horário daqui a pelo menos 5 minutos, ou use Publicar agora.");
    post.scheduledAt = when;
  } else {
    // Data passada, muito em cima ou dia já ocupado por outro post da marca: vai para o próximo dia livre às 20h.
    const proprios = await db.select({ id: socialPosts.id, brand: socialPosts.brand, stage: socialPosts.stage, scheduledAt: socialPosts.scheduledAt }).from(socialPosts);
    // Dias já ocupados no Postiz pelo mesmo canal (posts criados fora do Órbita, como os do pipeline antigo) também contam.
    const outros = [...proprios, ...(await occupiedInPostiz(channel.id, post.brand))];
    const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const clash = post.scheduledAt && outros.some(o => o.id !== post.id && o.brand === post.brand && o.stage !== "falhou" && o.scheduledAt && day(o.scheduledAt) === day(post.scheduledAt!));
    if (!post.scheduledAt || post.scheduledAt.getTime() < now + 2 * 3_600_000 || clash) post.scheduledAt = nextFreeSlot(outros, post.brand, new Date(now), post.id);
  }
  const error = stageError({ ...post, network: post.network as SocialNetwork }, "agendado");
  if (error) throw new Error(error);
  // Quem comentar recebe o link: a página precisa estar no ar antes de o post sair.
  const page = post.checks?.keyword ? post.checks?.pageUrl : null;
  if (page && !existing) {
    const st = await fetch(page, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(10_000) }).then(r => r.status, () => 0);
    if (st !== 200) throw new Error(`A página gratuita ainda não está no ar (${page} respondeu ${st || "sem resposta"}).`);
  }

  // Mídias na ordem do carrossel; o mesmo slide reenviado (mesmo nome ou com v2) vale a versão mais recente.
  // Reel/vídeo vai só com o vídeo; carrossel aceita imagens e vídeos; imagem vai só com imagens. O layout (HTML) fica fora.
  const all = await db.select({ id: socialMedia.id, filename: socialMedia.filename, contentType: socialMedia.contentType, createdAt: socialMedia.createdAt }).from(socialMedia).where(eq(socialMedia.postId, post.id));
  const { active: ordered, issues } = planMedia(post.format, all);
  if (issues.length) throw new Error(issues.join(" "));

  // Quantas criações este pedido gasta e quantas cabem agora: o canal principal tem de caber; as outras redes podem esperar.
  const pending = networks.filter(n => !done[n] && (n === post.network || pickChannel(channels, post.brand as SocialBrand, n)) && mediaForNetwork(n, post.format, ordered).length);
  const budget = createBudget.state();
  if (budget.blockedUntil) throw new PostizLimitError(budget.blockedUntil, "o Postiz pediu uma pausa");
  if (!done[post.network] && budget.remaining < 1) throw new PostizLimitError(createBudget.availableAt(1), `já foram ${budget.used} nesta hora`);
  let room = budget.remaining;

  const uploaded = new Map<string, PostizMedia>(Object.entries(existing?.midias ?? {}));
  for (const m of ordered) if (!uploaded.has(m.id)) uploaded.set(m.id, await uploadToPostiz(m.id));
  const media = ordered.map(m => uploaded.get(m.id)!);
  // Fora do Instagram não há automação da palavra-chave: o último slide (CTA "comenta X") vira a tela final.
  const keyword = post.checks?.keyword;
  const needsFinal = Boolean(keyword) && !wantsVideo && media.length > 1 && pending.some(n => n !== "instagram");
  const finalScreen = needsFinal ? await uploadFinalScreen(post.brand as SocialBrand).catch(() => null) : null;

  const erros: Record<string, string> = {};
  // "Publicar agora" pedido agora, ou rede extra retomada depois do horário do post (data passada no Postiz não vale).
  const late = Boolean(existing) && post.scheduledAt!.getTime() < Date.now() + 60_000;
  const now2 = (modo === "agora" && !existing) || late;
  // O principal primeiro: se o limite apertar, é ele que sai.
  for (const network of [post.network as SocialNetwork, ...networks.filter(n => n !== post.network)]) {
    if (!networks.includes(network) || done[network]) continue;
    const ch = network === post.network ? channel : pickChannel(channels, post.brand as SocialBrand, network);
    if (!ch) { erros[network] = "sem canal"; continue; }
    const { content, comment } = captionFor(network, post.caption!, { pageUrl: keyword ? post.checks?.pageUrl : null });
    // Carrossel com vídeo: só o Instagram recebe; as outras redes ficam de fora em vez de receber um pedaço.
    const networkMedia = mediaForNetwork(network, post.format, ordered).map(m => uploaded.get(m.id)!);
    if (!networkMedia.length) {
      if (network === post.network) throw new Error("Carrossel com vídeo só pode sair no Instagram: troque a rede principal ou use só imagens.");
      erros[network] = SEM_IMAGEM; continue;
    }
    if (room < 1 && network !== post.network) { erros[network] = `${LIMITE}: tente depois de ${hhmm(createBudget.availableAt(1) ?? Date.now() + 3_600_000)}`; continue; }
    const files = network !== "instagram" && finalScreen && networkMedia.length > 1 ? [...networkMedia.slice(0, -1), finalScreen] : networkMedia;
    try {
      const payload = buildSchedulePayload({ channel: ch, caption: content, comment, media: files, date: now2 ? new Date() : post.scheduledAt!, title: post.title, isVideo: wantsVideo, now: now2 });
      room--;
      const result = await postiz<Array<{ postId?: string; id?: string }>>("/posts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const postId = result?.[0]?.postId ?? result?.[0]?.id;
      if (!postId) throw new Error("o Postiz não devolveu o id do post");
      done[network] = { postId, integrationId: ch.id };
    } catch (e) {
      // O canal principal precisa sair; os outros ficam anotados e são tentados de novo no próximo "Agendar nas outras redes".
      if (network === post.network) throw e;
      erros[network] = e instanceof PostizLimitError ? `${LIMITE}: ${e.until ? `tente depois de ${hhmm(e.until)}` : "tente mais tarde"}` : e instanceof Error ? e.message.slice(0, 200) : "falhou";
      if (e instanceof PostizLimitError) room = 0;
    }
  }
  const main = done[post.network];
  const state: PostizState = {
    postId: main.postId, integrationId: main.integrationId, scheduledFor: post.scheduledAt!.toISOString(), at: existing?.at ?? new Date().toISOString(), canais: done,
    midias: Object.fromEntries(ordered.map(m => [m.id, uploaded.get(m.id)!])), ...((modo === "agora" && !existing) || existing?.agora ? { agora: true } : {}), ...(Object.keys(erros).length ? { erros } : {}),
  };
  const falhas = Object.entries(erros).filter(([, m]) => !SKIPPED(m)).map(([n]) => NETWORK_LABELS[n as SocialNetwork] ?? n);
  invalidateDeliveries();
  occupiedCache.clear();
  const [row] = await db.update(socialPosts).set({ stage: "agendado", scheduledAt: post.scheduledAt, checks: { ...post.checks, postiz: state, agendamento: null }, updatedAt: new Date() }).where(eq(socialPosts.id, post.id)).returning();
  return { post: row, postiz: state, already: false, falhas };
}

type RemotePost = { id: string; state?: string; publishDate?: string; releaseURL?: string | null; releaseId?: string | null; error?: string | null; content?: string | null; integration?: { id?: string } | null; integrationId?: string; deletedAt?: string | null };

/**
 * Fechamento: posts agendados que o Postiz já publicou viram Publicado com link e media_id; erro vira Falhou.
 * Também acha post que saiu direto pelo Postiz (ficou em Aprovado ou Falhou na Órbita): mesma legenda, já publicado,
 * no canal principal da marca e sem vínculo com outro post. Esse vira Publicado com o link e o media_id do Postiz.
 */
export async function syncScheduledPosts(now = new Date()) {
  const db = await getDb();
  const rows = await db.select().from(socialPosts).where(inArray(socialPosts.stage, ["agendado", "aprovado", "falhou"]));
  const scheduled = rows.filter(p => p.stage === "agendado" && postizOf(p));
  const day = 86_400_000;
  const unlinked = rows.filter(p => p.stage !== "agendado" && !postizOf(p) && p.caption && now.getTime() - p.updatedAt.getTime() < 30 * day);
  if (!scheduled.length && !unlinked.length) return { checked: 0, published: 0, failed: 0, linked: 0 };
  const times = [...scheduled.map(p => new Date(postizOf(p)!.scheduledFor).getTime()), ...(unlinked.length ? [now.getTime() - 14 * day] : [])];
  const start = new Date(Math.min(...times) - day).toISOString(), end = new Date(Math.max(...times, now.getTime()) + day).toISOString();
  const list = await postiz<{ posts?: RemotePost[] } | RemotePost[]>(`/posts?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`);
  const remoteList = Array.isArray(list) ? list : list?.posts ?? [];
  const remote = new Map(remoteList.map(r => [r.id, r]));
  let published = 0, failed = 0, linked = 0;
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
  if (unlinked.length) {
    const taken = new Set<string>();
    const all = await db.select({ checks: socialPosts.checks }).from(socialPosts);
    for (const r of all) { const s = postizOf(r); if (s) { taken.add(s.postId); for (const c of Object.values(s.canais ?? {})) taken.add(c.postId); } }
    const who = new Map((await postizChannels()).map(c => [c.id, channelIdentity(c)]));
    for (const p of unlinked) {
      const match = remoteList
        .filter(r => r.state === "PUBLISHED" && !r.deletedAt && !taken.has(r.id) && sameCaption(r.content, p.caption))
        .filter(r => { const id = who.get(r.integration?.id ?? r.integrationId ?? ""); return id?.brand === p.brand && id.network === p.network; })
        .sort((a, b) => Date.parse(b.publishDate ?? "") - Date.parse(a.publishDate ?? ""))[0];
      if (!match) continue;
      taken.add(match.id);
      linked++;
      const state: PostizState = { postId: match.id, integrationId: match.integration?.id ?? match.integrationId ?? "", scheduledFor: match.publishDate ?? now.toISOString(), at: now.toISOString() };
      await db.update(socialPosts).set({
        stage: "publicado", publishedUrl: match.releaseURL ?? p.publishedUrl, scheduledAt: match.publishDate ? new Date(match.publishDate) : p.scheduledAt,
        checks: { ...p.checks, postiz: state, mediaId: match.releaseId ?? p.checks?.mediaId ?? null, vinculadoPeloFechamento: true, agendamento: null },
        notes: `${p.notes ?? ""}\n\n[Fechamento ${now.toISOString().slice(0, 16)}] saiu direto pelo Postiz; vinculado pela legenda.`.trim(), updatedAt: new Date(),
      }).where(and(eq(socialPosts.id, p.id), eq(socialPosts.stage, p.stage)));
    }
  }
  if (published || failed || linked) invalidateDeliveries();
  return { checked: scheduled.length + unlinked.length, published, failed, linked };
}

/**
 * Depois do fechamento: tenta de novo o que parou no limite do Postiz (aprovação pendente e redes extras),
 * até 3 posts por rodada. A aprovação já é do Antonio; aqui só se completa o agendamento.
 */
export async function retryPendingSchedules() {
  const db = await getDb();
  const rows = await db.select().from(socialPosts).where(inArray(socialPosts.stage, ["aprovado", "agendado"]));
  const due = rows.filter(p => p.stage === "aprovado" ? p.checks?.agendamento?.pendente : Object.values(postizOf(p)?.erros ?? {}).some(m => m.startsWith(LIMITE))).slice(0, 3);
  const out: { id: string; ok: boolean; erro?: string }[] = [];
  for (const p of due) {
    try {
      // O horário escolhido pode ter passado: a nova tentativa cai na regra automática.
      await scheduleSocialPost(p.id, p.stage === "aprovado" ? { modo: p.checks?.agendamento?.modo === "data" && p.scheduledAt && p.scheduledAt.getTime() > Date.now() + MIN_LEAD_MS ? "data" : "auto" } : {});
      out.push({ id: p.id, ok: true });
    } catch (e) {
      out.push({ id: p.id, ok: false, erro: e instanceof Error ? e.message.slice(0, 200) : "falhou" });
      if (e instanceof PostizLimitError) break;
    }
  }
  return { tentados: out.length, agendados: out.filter(o => o.ok).length, resultados: out };
}

/* ───────────── conciliação sob demanda (posts feitos fora da Órbita) ───────────── */

const readExternal = async () => {
  const db = await getDb();
  const start = new Date(Date.now() - 7 * 86_400_000).toISOString(), end = new Date(Date.now() + 21 * 86_400_000).toISOString();
  const [channels, list, rows] = await Promise.all([
    postizChannels(),
    postiz<{ posts?: RemoteListedPost[] } | RemoteListedPost[]>(`/posts?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`),
    db.select({ checks: socialPosts.checks }).from(socialPosts).where(inArray(socialPosts.stage, ["aprovado", "agendado", "publicado", "falhou"])),
  ]);
  const linked = new Set<string>();
  for (const r of rows) {
    const s = postizOf(r);
    if (!s) continue;
    linked.add(s.postId);
    for (const c of Object.values(s.canais ?? {})) linked.add(c.postId);
  }
  return { posts: reconcileExternal(Array.isArray(list) ? list : list?.posts ?? [], channels, linked), checkedAt: new Date().toISOString() };
};
/** Cache de 30 min no servidor: abrir o calendário várias vezes não repete chamadas ao Postiz nem ao banco. */
const cachedExternal = unstable_cache(readExternal, ["postiz-external-v1"], { revalidate: 1800, tags: ["postiz-external"] });
export async function externalSocialPosts(force = false) {
  if (force) revalidateTag("postiz-external", { expire: 0 });
  return cachedExternal();
}
