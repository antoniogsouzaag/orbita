import "server-only";
import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { AwsClient } from "aws4fetch";
import { z } from "zod";
import { getDb } from "@/db";
import { socialMedia, socialPosts } from "@/db/schema";

export const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4"] as const;
export const MEDIA_MAX_BYTES = 8 * 1024 * 1024;
/** Retenção: mídia de post publicado sai depois de 7 dias; arquivo sem post, depois de 3. */
export const MEDIA_RETENTION = { publishedDays: 7, orphanDays: 3 } as const;

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
const objectUrl = (b: Pick<Bucket, "endpoint" | "bucket">, path: string) => `${b.endpoint}/${b.bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
const publicUrl = objectUrl;

async function bucketUpload(b: Bucket, path: string, bytes: Uint8Array, contentType: string) {
  const res = await b.client.fetch(objectUrl(b, path), {
    method: "PUT", body: Buffer.from(bytes), signal: AbortSignal.timeout(30_000),
    headers: { "content-type": contentType, "cache-control": "public, max-age=31536000, immutable" },
  });
  if (!res.ok) throw new Error(`Storage respondeu ${res.status}.`);
}
async function bucketRemove(b: Bucket, paths: string[]) {
  for (const path of paths) {
    const res = await b.client.fetch(objectUrl(b, path), { method: "DELETE", signal: AbortSignal.timeout(15_000) });
    // 404 = já não existe; segue a limpeza.
    if (!res.ok && res.status !== 404) throw new Error(`Storage respondeu ${res.status} ao apagar.`);
  }
}

/* ───────────── API ───────────── */

/** Guarda a mídia (Neon Object Storage se configurado; senão no banco) e, se o post ainda não tem mídia principal, usa esta como capa. */
export async function saveSocialMedia(input: { bytes: Uint8Array; filename: string; contentType: string; postId?: string | null; origin: string; setCover?: boolean }) {
  const type = z.enum(MEDIA_TYPES).parse(input.contentType);
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
  if (b) {
    const path = `${postId ?? "avulsa"}/${id}-${filename.replace(/\s+/g, "-")}`;
    await bucketUpload(b, path, input.bytes, type);
    stored = { storage: "s3", path, data: null };
    url = publicUrl(b, path);
  } else {
    stored = { storage: "db", path: null, data: Buffer.from(input.bytes).toString("base64") };
    url = new URL(mediaPath(id), input.origin).toString();
  }
  const [row] = await db.insert(socialMedia).values({ id, postId, filename, contentType: type, size: input.bytes.byteLength, ...stored })
    .returning({ id: socialMedia.id, filename: socialMedia.filename, contentType: socialMedia.contentType, size: socialMedia.size, storage: socialMedia.storage, createdAt: socialMedia.createdAt });
  if (postId) {
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

export async function listPostMedia(postId: string, origin: string) {
  const db = await getDb();
  const b = mediaBucket();
  const rows = await db.select({ id: socialMedia.id, filename: socialMedia.filename, contentType: socialMedia.contentType, size: socialMedia.size, storage: socialMedia.storage, path: socialMedia.path, createdAt: socialMedia.createdAt })
    .from(socialMedia).where(eq(socialMedia.postId, z.uuid().parse(postId))).orderBy(desc(socialMedia.createdAt));
  return rows.map(({ path, ...r }) => ({ ...r, url: r.storage !== "db" && path && b ? publicUrl(b, path) : new URL(mediaPath(r.id), origin).toString() }));
}

/** Limpeza diária: mídia de post publicado há mais de 7 dias e arquivo avulso com mais de 3. O link fica no post como registro. */
export async function cleanupSocialMedia(now = new Date()) {
  const db = await getDb();
  const published = new Date(now.getTime() - MEDIA_RETENTION.publishedDays * 86_400_000);
  const orphan = new Date(now.getTime() - MEDIA_RETENTION.orphanDays * 86_400_000);
  const doneIds = db.select({ id: socialPosts.id }).from(socialPosts).where(and(eq(socialPosts.stage, "publicado"), lt(socialPosts.updatedAt, published)));
  const old = await db.select({ id: socialMedia.id, storage: socialMedia.storage, path: socialMedia.path }).from(socialMedia)
    .where(or(inArray(socialMedia.postId, doneIds), and(isNull(socialMedia.postId), lt(socialMedia.createdAt, orphan))));
  if (!old.length) return { removed: 0 };
  const b = mediaBucket();
  const paths = old.filter(m => m.storage !== "db" && m.path).map(m => m.path!);
  // Remove do bucket primeiro: se falhar, as linhas ficam e a próxima rodada tenta de novo.
  if (paths.length && b) await bucketRemove(b, paths);
  const removable = old.filter(m => m.storage === "db" || b).map(m => m.id);
  if (removable.length) await db.delete(socialMedia).where(inArray(socialMedia.id, removable));
  return { removed: removable.length, bucket: paths.length, kept: old.length - removable.length, at: now.toISOString() };
}
