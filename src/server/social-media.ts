import "server-only";
import { desc, eq, isNull, and } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { socialMedia, socialPosts } from "@/db/schema";

export const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4"] as const;
export const MEDIA_MAX_BYTES = 8 * 1024 * 1024;

export const mediaPath = (id: string) => `/api/redes/midia/${id}`;

/** Guarda a mídia e, se o post ainda não tem mídia principal, usa esta como capa. */
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
  const [row] = await db.insert(socialMedia).values({ postId, filename, contentType: type, size: input.bytes.byteLength, data: Buffer.from(input.bytes).toString("base64") })
    .returning({ id: socialMedia.id, filename: socialMedia.filename, contentType: socialMedia.contentType, size: socialMedia.size, createdAt: socialMedia.createdAt });
  const url = new URL(mediaPath(row.id), input.origin).toString();
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
  return row ?? null;
}

export async function listPostMedia(postId: string, origin: string) {
  const db = await getDb();
  const rows = await db.select({ id: socialMedia.id, filename: socialMedia.filename, contentType: socialMedia.contentType, size: socialMedia.size, createdAt: socialMedia.createdAt })
    .from(socialMedia).where(eq(socialMedia.postId, z.uuid().parse(postId))).orderBy(desc(socialMedia.createdAt));
  return rows.map(r => ({ ...r, url: new URL(mediaPath(r.id), origin).toString() }));
}
