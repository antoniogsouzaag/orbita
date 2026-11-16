import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { AwsClient } from "aws4fetch";
import { z } from "zod";
import { getDb } from "@/db";
import { opsEvents, socialMedia, socialPosts } from "@/db/schema";
import { isLayout, LAYOUT_FILENAME, LAYOUT_TYPE, sanitizeLayout } from "@/lib/social-layout";
import { planMedia } from "@/lib/social-postiz";

/** text/html = layout editável do post (slides.html); nunca vira capa nem entra no carrossel. */
export const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", LAYOUT_TYPE] as const;
export const MEDIA_MAX_BYTES = 8 * 1024 * 1024;
/**
 * Retenção (dias). Publicado: tudo sai depois de 7 dias, menos a capa em imagem, que fica de registro.
 * Falhou: 14 dias (dá tempo de pedir ajuste e reaproveitar). Versão substituída: 2 dias. Avulsa: 3 dias.
 * Objeto no bucket sem linha na tabela (post apagado, envio interrompido): 1 dia.
 */
export const MEDIA_RETENTION = { publishedDays: 7, failedDays: 14, supersededDays: 2, orphanDays: 3, unlinkedObjectDays: 1 } as const;
/** A limpeza automática nunca toca na mídia destes posts. */
export const MEDIA_UNTOUCHABLE_STAGES = ["revisao", "aprovado", "agendado"] as const;
/** Por rodada: o resto fica para o dia seguinte. */
const CLEANUP_MAX = 400;

export const mediaPath = (id: string) => `/api/redes/midia/${id}`;

/* ───────────── Object storage S3 (Neon Object Storage) ───────────── */

type Bucket = { endpoint: string; region: string; bucket: string; client: AwsClient };
/** MEDIA_S3_ENDPOINT + MEDIA_S3_REGION + MEDIA_S3_BUCKET (public_read) + MEDIA_S3_ACCESS_KEY_ID + MEDIA_S3_SECRET_ACCESS_KEY. */
export function mediaBucket(): Bucket | null {
  const endpoint = process.env.MEDIA_S3_ENDPOINT?.replace(/\/$/, "");
  const accessKeyId = process.env.MEDIA_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.MEDIA_S3_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) return null;
  const region = process.env.MEDIA_S3_REGION || "us-east-1";
  return { endpoint, region, bucket: process.env.MEDIA_S3_BUCKET || "redes", client: new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region }) };
}
// Endereçamento por caminho (force_path_style): endpoint/bucket/chave. Bucket public_read abre sem assinatura.
const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");
const objectUrl = (b: Pick<Bucket, "endpoint" | "bucket">, path: string) => `${b.endpoint}/${b.bucket}/${encodePath(path)}`;
const publicUrl = objectUrl;

async function bucketUpload(b: Bucket, path: string, bytes: Uint8Array, contentType: string) {
  // Assina e envia com o corpo inteiro (Content-Length). Via Request o corpo vira stream "chunked",
  // e o storage do Neon trava em arquivos acima de ~0,5 MB.
  const body = new Uint8Array(bytes);
  const signed = await b.client.sign(objectUrl(b, path), {
    method: "PUT", body,
    headers: { "content-type": contentType, "cache-control": "public, max-age=31536000, immutable" },
  });
  const res = await fetch(signed.url, { method: "PUT", headers: signed.headers, body, signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`Storage respondeu ${res.status}.`);
}
async function bucketRemove(b: Bucket, path: string) {
  const res = await b.client.fetch(objectUrl(b, path), { method: "DELETE", signal: AbortSignal.timeout(15_000) });
  // 404 = já não existe; segue a limpeza.
  if (!res.ok && res.status !== 404) throw new Error(`Storage respondeu ${res.status} ao apagar.`);
}
const xmlText = (t: string) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
/** ListObjectsV2 do bucket inteiro (até 5.000 objetos). */
async function bucketList(b: Bucket) {
  const out: { key: string; lastModified: Date; size: number }[] = [];
  let token: string | null = null;
  do {
    const qs = new URLSearchParams({ "list-type": "2", "max-keys": "1000", ...(token ? { "continuation-token": token } : {}) });
    const res = await b.client.fetch(`${b.endpoint}/${b.bucket}?${qs}`, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Storage respondeu ${res.status} ao listar.`);
    const xml = await res.text();
    for (const [, item] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = /<Key>([\s\S]*?)<\/Key>/.exec(item)?.[1];
      const mod = /<LastModified>([\s\S]*?)<\/LastModified>/.exec(item)?.[1];
      if (key && mod) out.push({ key: xmlText(key), lastModified: new Date(mod), size: Number(/<Size>(\d+)<\/Size>/.exec(item)?.[1] ?? 0) });
    }
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? xmlText(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1] ?? "") || null : null;
  } while (token && out.length < 5000);
  return out;
}

type StoredRow = { id: string; storage: string; path: string | null };
/** Link de uma mídia: o objeto público no bucket ou a rota da Órbita (mídia guardada no banco). */
function rowUrl(row: StoredRow, b: Bucket | null, origin: string) {
  return row.storage !== "db" && row.path && b ? publicUrl(b, row.path) : new URL(mediaPath(row.id), origin).toString();
}
/** O link (capa do post) aponta para esta mídia? Vale para os dois armazenamentos e para endpoint trocado. */
function refersTo(url: string | null | undefined, row: StoredRow) {
  if (!url) return false;
  return url.endsWith(mediaPath(row.id)) || Boolean(row.path && url.endsWith(`/${encodePath(row.path)}`));
}

/* ───────────── API ───────────── */

/** Guarda a mídia (Neon Object Storage se configurado; senão no banco) e, se o post ainda não tem mídia principal, usa esta como capa. */
export async function saveSocialMedia(input: { bytes: Uint8Array; filename: string; contentType: string; postId?: string | null; origin: string; setCover?: boolean }) {
  const type = z.enum(MEDIA_TYPES).parse(input.contentType.split(";")[0].trim());
  const layout = isLayout(type);
  if (layout) input = { ...input, bytes: new TextEncoder().encode(sanitizeLayout(new TextDecoder().decode(input.bytes))), filename: LAYOUT_FILENAME, setCover: false };
  if (!input.bytes.byteLength) throw new Error("Arquivo vazio.");
  if (input.bytes.byteLength > MEDIA_MAX_BYTES) throw new Error("Arquivo acima de 8 MB.");
  const postId = input.postId ? z.uuid().parse(input.postId) : null;
  const filename = input.filename.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "midia";
  const db = await getDb();
  if (postId) {
    const [post] = await db.select({ id: socialPosts.id }).from(socialPosts).where(eq(socialPosts.id, postId));
    if (!post) throw new Error("Post não encontrado.");
  }
  const id = crypto.randomUUID();
  const b = mediaBucket();
  let url: string;
  let stored: { storage: string; path: string | null; data: string | null };
  const path = `${postId ?? "avulsa"}/${id}-${filename.replace(/\s+/g, "-")}`;
  // Storage indisponível ou lento não pode perder o envio: cai para o banco e registra o motivo no log.
  const sent = b ? await bucketUpload(b, path, input.bytes, type).then(() => true, (e: unknown) => { console.error(`[redes/midia] storage falhou, guardando no banco: ${e instanceof Error ? `${e.name}: ${e.message}` : e}`); return false; }) : false;
  if (b && sent) {
    stored = { storage: "s3", path, data: null };
    url = publicUrl(b, path);
  } else {
    stored = { storage: "db", path: null, data: Buffer.from(input.bytes).toString("base64") };
    url = new URL(mediaPath(id), input.origin).toString();
  }
  const [row] = await db.insert(socialMedia).values({ id, postId, filename, contentType: type, size: input.bytes.byteLength, ...stored })
    .returning({ id: socialMedia.id, filename: socialMedia.filename, contentType: socialMedia.contentType, size: socialMedia.size, storage: socialMedia.storage, createdAt: socialMedia.createdAt });
  if (postId && !layout) {
    const cover = input.setCover ? eq(socialPosts.id, postId) : and(eq(socialPosts.id, postId), isNull(socialPosts.mediaUrl));
    await db.update(socialPosts).set({ mediaUrl: url, updatedAt: new Date() }).where(cover);
  }
  return { ...row, url };
}

export async function getSocialMedia(id: string) {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return null;
  const db = await getDb();
  const [row] = await db.select().from(socialMedia).where(eq(socialMedia.id, parsed.data));
  if (!row) return null;
  const b = mediaBucket();
  return { ...row, publicUrl: row.storage !== "db" && row.path && b ? publicUrl(b, row.path) : null };
}

/** Layout mais recente do post (o HTML já limpo), ou null se o agente não anexou. */
export async function getPostLayout(postId: string) {
  const db = await getDb();
  const [row] = await db.select().from(socialMedia)
    .where(and(eq(socialMedia.postId, z.uuid().parse(postId)), eq(socialMedia.contentType, LAYOUT_TYPE)))
    .orderBy(desc(socialMedia.createdAt)).limit(1);
  if (!row) return null;
  const b = mediaBucket();
  let html: string;
  if (row.data) html = Buffer.from(row.data, "base64").toString("utf8");
  else if (row.path && b) {
    const res = await fetch(publicUrl(b, row.path), { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Storage respondeu ${res.status} ao abrir o layout.`);
    html = await res.text();
  } else throw new Error("Layout fora do armazenamento configurado.");
  return { id: row.id, createdAt: row.createdAt, html: sanitizeLayout(html) };
}

const mediaColumns = { id: socialMedia.id, postId: socialMedia.postId, filename: socialMedia.filename, contentType: socialMedia.contentType, size: socialMedia.size, storage: socialMedia.storage, path: socialMedia.path, createdAt: socialMedia.createdAt };
type MediaRow = { id: string; postId: string | null; filename: string; contentType: string; size: number; storage: string; path: string | null; createdAt: Date };

/** vai = entra no post, nesta ordem; substituida = versão antiga do mesmo slide; fora = não serve a este formato (layout, capa de reel). */
export type MediaUse = "vai" | "substituida" | "fora";
/** Versões antigas do layout também são substituídas: o editor sempre abre o mais recente. */
function supersededIds(format: string, rows: MediaRow[]) {
  const ids = new Set(planMedia(format, rows).superseded.map(r => r.id));
  const layouts = rows.filter(r => r.contentType === LAYOUT_TYPE).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  for (const old of layouts.slice(1)) ids.add(old.id);
  return ids;
}
function describeMedia(format: string, rows: MediaRow[]) {
  const plan = planMedia(format, rows);
  const order = new Map(plan.active.map((r, i) => [r.id, i + 1]));
  const old = supersededIds(format, rows);
  return {
    plan,
    uses: new Map(rows.map(r => [r.id, { uso: (order.has(r.id) ? "vai" : old.has(r.id) ? "substituida" : "fora") as MediaUse, ordem: order.get(r.id) ?? null }])),
  };
}

/** Mídias do post com o que vai para a rede (na ordem), o que foi substituído e os bloqueios de aprovação. */
export async function postMediaPlan(postId: string, origin: string) {
  const db = await getDb();
  const id = z.uuid().parse(postId);
  const [post] = await db.select({ format: socialPosts.format, mediaUrl: socialPosts.mediaUrl }).from(socialPosts).where(eq(socialPosts.id, id));
  if (!post) throw new Error("Post não encontrado.");
  const rows = await db.select(mediaColumns).from(socialMedia).where(eq(socialMedia.postId, id)).orderBy(desc(socialMedia.createdAt));
  const b = mediaBucket();
  const { plan, uses } = describeMedia(post.format, rows);
  const midias = rows.map(({ path, postId: _postId, ...r }) => {
    void _postId;
    return { ...r, ...uses.get(r.id)!, capa: refersTo(post.mediaUrl, { ...r, path }), url: rowUrl({ ...r, path }, b, origin) };
  }).sort((a, z2) => (a.ordem ?? 999) - (z2.ordem ?? 999) || z2.createdAt.getTime() - a.createdAt.getTime());
  return { midias, avisos: plan.issues, vao: plan.active.length, substituidas: midias.filter(m => m.uso === "substituida").length };
}

/** Bloqueios objetivos de mídia (limite de 10, reel com mais de um vídeo, sem mídia), para recusar a aprovação antes do Postiz. */
export async function postMediaIssues(postId: string) {
  const db = await getDb();
  const id = z.uuid().parse(postId);
  const [post] = await db.select({ format: socialPosts.format }).from(socialPosts).where(eq(socialPosts.id, id));
  if (!post) throw new Error("Post não encontrado.");
  const rows = await db.select(mediaColumns).from(socialMedia).where(eq(socialMedia.postId, id));
  return planMedia(post.format, rows).issues;
}

/** Bloqueios de mídia de vários posts numa consulta só (lista do MCP). */
export async function mediaIssuesByPost(posts: { id: string; format: string }[]) {
  const out = new Map<string, { vao: number; substituidas: number; avisos: string[] }>();
  if (!posts.length) return out;
  const db = await getDb();
  const rows = await db.select(mediaColumns).from(socialMedia).where(inArray(socialMedia.postId, posts.map(p => p.id)));
  for (const p of posts) {
    const mine = rows.filter(r => r.postId === p.id);
    const plan = planMedia(p.format, mine);
    out.set(p.id, { vao: plan.active.length, substituidas: supersededIds(p.format, mine).size, avisos: plan.issues });
  }
  return out;
}

export async function listPostMedia(postId: string, origin: string) {
  return (await postMediaPlan(postId, origin)).midias;
}

/** Antes de aprovar dá para tirar mídia; agendado e publicado já estão no Postiz e não mudam pela Órbita. */
const REMOVABLE_STAGES = ["ideia", "briefing", "rascunho", "revisao", "aprovado", "falhou"];

/**
 * Remove mídias de um post (a pedido: tela ou agente). `ids` escolhe quais; `substituidas` tira todas as versões antigas.
 * Apaga o objeto no bucket e depois a linha; se a capa saiu, a primeira mídia que vai para a rede vira a capa.
 */
export async function removeSocialMedia(input: { postId: string; ids?: string[]; substituidas?: boolean; origin: string }) {
  const db = await getDb();
  const postId = z.uuid().parse(input.postId);
  const ids = z.array(z.uuid()).max(50).parse(input.ids ?? []);
  const [post] = await db.select().from(socialPosts).where(eq(socialPosts.id, postId));
  if (!post) throw new Error("Post não encontrado.");
  if (!REMOVABLE_STAGES.includes(post.stage) || (post.stage === "aprovado" && post.checks?.postiz)) throw new Error("Este post já está no Postiz: a mídia não muda mais pela Órbita.");
  const rows = await db.select(mediaColumns).from(socialMedia).where(eq(socialMedia.postId, postId));
  const foreign = ids.filter(id => !rows.some(r => r.id === id));
  if (foreign.length) throw new Error(`Mídia não encontrada neste post: ${foreign.join(", ")}.`);
  const old = input.substituidas ? supersededIds(post.format, rows) : new Set<string>();
  const targets = rows.filter(r => ids.includes(r.id) || old.has(r.id));
  if (!targets.length) throw new Error(input.substituidas ? "Não há versões antigas neste post." : "Escolha a mídia a remover.");
  const b = mediaBucket();
  const removed: { id: string; filename: string }[] = [];
  for (const t of targets) {
    // Objeto primeiro: se o storage falhar, a linha fica e dá para tentar de novo.
    if (t.storage !== "db" && t.path && b) await bucketRemove(b, t.path);
    await db.delete(socialMedia).where(eq(socialMedia.id, t.id));
    removed.push({ id: t.id, filename: t.filename });
  }
  const remaining = rows.filter(r => !targets.includes(r));
  const plan = planMedia(post.format, remaining);
  let capa = post.mediaUrl;
  if (targets.some(t => refersTo(post.mediaUrl, t))) {
    const next = plan.active[0] ?? remaining.find(r => r.contentType.startsWith("image/") || r.contentType.startsWith("video/"));
    capa = next ? rowUrl(next, b, input.origin) : null;
    await db.update(socialPosts).set({ mediaUrl: capa, updatedAt: new Date() }).where(eq(socialPosts.id, postId));
  }
  return { removidas: removed, capa, vao: plan.active.length, avisos: plan.issues };
}

/** Post apagado: os objetos dele no bucket saem junto (as linhas já saem em cascata). Falha aqui fica para a limpeza diária. */
export async function removePostObjects(rows: StoredRow[]) {
  const b = mediaBucket();
  if (!b) return;
  for (const r of rows) if (r.storage !== "db" && r.path) await bucketRemove(b, r.path).catch((e: unknown) => console.error(`[redes/midia] objeto ${r.path} fica para a limpeza: ${e instanceof Error ? e.message : e}`));
}
export async function postStoredMedia(postId: string): Promise<StoredRow[]> {
  const db = await getDb();
  return db.select({ id: socialMedia.id, storage: socialMedia.storage, path: socialMedia.path }).from(socialMedia).where(eq(socialMedia.postId, postId));
}

type Motivo = "publicado" | "falhou" | "substituida" | "avulsa" | "sem_registro";
const UUID_PREFIX = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|avulsa)\//;

/**
 * Limpeza diária, idempotente (rodar de novo não acha nada). Remove: mídia de publicado há mais de 7 dias (a capa em
 * imagem fica e a lista do que saiu vai para checks.arquivo), de falhou há mais de 14, versões substituídas com mais
 * de 2 dias, avulsas com mais de 3 e objetos do bucket sem registro (post apagado). Nunca toca em post de Revisão,
 * Aprovado ou Agendado. `simular` devolve o mesmo relatório sem apagar nada. O que sai fica registrado na Operação.
 */
export async function cleanupSocialMedia(now = new Date(), opts: { simular?: boolean } = {}) {
  const db = await getDb();
  const day = 86_400_000, t = now.getTime();
  const cut = { published: t - MEDIA_RETENTION.publishedDays * day, failed: t - MEDIA_RETENTION.failedDays * day, superseded: t - MEDIA_RETENTION.supersededDays * day, orphan: t - MEDIA_RETENTION.orphanDays * day, unlinked: t - MEDIA_RETENTION.unlinkedObjectDays * day };
  const [posts, media] = await Promise.all([
    db.select({ id: socialPosts.id, stage: socialPosts.stage, format: socialPosts.format, updatedAt: socialPosts.updatedAt, mediaUrl: socialPosts.mediaUrl, checks: socialPosts.checks }).from(socialPosts),
    db.select(mediaColumns).from(socialMedia),
  ]);
  const byPost = new Map(posts.map(p => [p.id, p]));
  const untouchable = new Set<string>(MEDIA_UNTOUCHABLE_STAGES);
  const rowsOf = new Map<string, MediaRow[]>();
  for (const m of media) if (m.postId) rowsOf.set(m.postId, [...(rowsOf.get(m.postId) ?? []), m]);
  const old = new Map([...rowsOf].map(([id, rows]) => [id, supersededIds(byPost.get(id)?.format ?? "", rows)]));

  const picked: (MediaRow & { motivo: Motivo })[] = [];
  for (const m of media) {
    if (picked.length >= CLEANUP_MAX) break;
    if (!m.postId) { if (m.createdAt.getTime() < cut.orphan) picked.push({ ...m, motivo: "avulsa" }); continue; }
    const post = byPost.get(m.postId);
    if (!post || untouchable.has(post.stage)) continue;
    const cover = refersTo(post.mediaUrl, m);
    if (post.stage === "publicado" && post.updatedAt.getTime() < cut.published && !(cover && m.contentType.startsWith("image/"))) picked.push({ ...m, motivo: "publicado" });
    else if (post.stage === "falhou" && post.updatedAt.getTime() < cut.failed) picked.push({ ...m, motivo: "falhou" });
    else if (!cover && old.get(post.id)?.has(m.id) && m.createdAt.getTime() < cut.superseded) picked.push({ ...m, motivo: "substituida" });
  }

  // Objetos sem linha: só nas pastas de post (uuid/) e avulsa/, nunca em pasta de post que a limpeza não pode tocar
  // nem em objeto que ainda é a capa de algum post.
  const b = mediaBucket();
  let bucket = b ? "ok" : "sem storage configurado";
  const unlinked: { key: string; size: number }[] = [];
  if (b) {
    try {
      const known = new Set(media.map(m => m.path).filter(Boolean));
      const covers = posts.map(p => p.mediaUrl).filter((u): u is string => Boolean(u));
      for (const o of await bucketList(b)) {
        if (unlinked.length + picked.length >= CLEANUP_MAX) break;
        const prefix = UUID_PREFIX.exec(o.key)?.[1];
        if (!prefix || known.has(o.key) || o.lastModified.getTime() >= cut.unlinked) continue;
        const owner = byPost.get(prefix);
        if (owner && untouchable.has(owner.stage)) continue;
        if (covers.some(u => u.endsWith(`/${encodePath(o.key)}`))) continue;
        unlinked.push({ key: o.key, size: o.size });
      }
    } catch (e) { bucket = `listagem indisponível: ${e instanceof Error ? e.message : e}`; }
  }

  const removed: { post: string | null; arquivo: string; motivo: Motivo; bytes: number }[] = [];
  const failures: string[] = [];
  if (!opts.simular) {
    for (const m of picked) {
      try {
        if (m.storage !== "db" && m.path) { if (!b) continue; await bucketRemove(b, m.path); }
        await db.delete(socialMedia).where(eq(socialMedia.id, m.id));
        removed.push({ post: m.postId, arquivo: m.filename, motivo: m.motivo, bytes: m.size });
      } catch (e) { failures.push(`${m.filename}: ${e instanceof Error ? e.message : e}`); }
    }
    for (const o of unlinked) {
      try { await bucketRemove(b!, o.key); removed.push({ post: UUID_PREFIX.exec(o.key)?.[1] ?? null, arquivo: o.key, motivo: "sem_registro", bytes: o.size }); }
      catch (e) { failures.push(`${o.key}: ${e instanceof Error ? e.message : e}`); }
    }
    // Arquivo do post publicado/falhou: o que saiu fica anotado no próprio post.
    const archived = new Map<string, string[]>();
    for (const r of removed) if (r.post && (r.motivo === "publicado" || r.motivo === "falhou")) archived.set(r.post, [...(archived.get(r.post) ?? []), r.arquivo]);
    for (const [id, files] of archived) {
      const p = byPost.get(id)!;
      const prev = p.checks?.arquivo;
      await db.update(socialPosts).set({ checks: { ...p.checks, arquivo: { at: now.toISOString(), removidas: (prev?.removidas ?? 0) + files.length, arquivos: [...(prev?.arquivos ?? []), ...files].slice(-40) } } }).where(eq(socialPosts.id, id));
    }
  } else {
    for (const m of picked) removed.push({ post: m.postId, arquivo: m.filename, motivo: m.motivo, bytes: m.size });
    for (const o of unlinked) removed.push({ post: UUID_PREFIX.exec(o.key)?.[1] ?? null, arquivo: o.key, motivo: "sem_registro", bytes: o.size });
  }
  const bytes = removed.reduce((s, r) => s + r.bytes, 0);
  const motivos = removed.reduce<Partial<Record<Motivo, number>>>((acc, r) => ({ ...acc, [r.motivo]: (acc[r.motivo] ?? 0) + 1 }), {});
  const report = { simulado: Boolean(opts.simular), removed: removed.length, mb: Math.round(bytes / 104857.6) / 10, motivos, falhas: failures.slice(0, 20), bucket, retencao: MEDIA_RETENTION, at: now.toISOString() };
  if (!opts.simular && removed.length) {
    await db.insert(opsEvents).values({
      kind: "midia_limpeza", severity: failures.length ? "warning" : "info", source: "orbita:cron-midia",
      subject: `Limpeza de mídias: ${removed.length} arquivo(s), ${report.mb} MB`,
      detail: { ...report, arquivos: removed.slice(0, 200).map(({ bytes: _b, ...r }) => { void _b; return r; }) },
    });
  }
  return { ...report, arquivos: removed.slice(0, 50).map(r => ({ post: r.post?.slice(0, 8) ?? null, arquivo: r.arquivo, motivo: r.motivo })) };
}
