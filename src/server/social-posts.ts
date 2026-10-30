import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { socialPosts, type SocialPost } from "@/db/schema";
import { SOCIAL_BRANDS, SOCIAL_FORMATS, SOCIAL_NETWORKS, SOCIAL_STAGES, stageError, type SocialNetwork, type SocialStage } from "@/lib/social-pipeline";

const optionalText = (max: number) => z.string().trim().max(max).transform(v => v || null).nullable().optional();
const optionalUrl = z.string().trim().max(2000).transform(v => v || null).nullable().optional().refine(v => !v || /^https?:\/\//.test(v), "Use um link http(s).");

export const socialPostSchema = z.object({
  brand: z.enum(SOCIAL_BRANDS),
  network: z.enum(SOCIAL_NETWORKS),
  format: z.enum(SOCIAL_FORMATS),
  title: z.string().trim().min(1).max(200),
  hook: optionalText(300),
  caption: optionalText(70000),
  cta: optionalText(300),
  mediaUrl: optionalUrl,
  referenceUrl: optionalUrl,
  publishedUrl: optionalUrl,
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
  checks: z.object({ brandReviewed: z.boolean().optional(), ctaDeliverable: z.boolean().optional() }).optional(),
  notes: optionalText(5000),
});
export type SocialPostInput = z.input<typeof socialPostSchema>;

const asQuality = (p: Pick<SocialPost, "network" | "hook" | "caption" | "cta" | "mediaUrl" | "referenceUrl" | "scheduledAt" | "checks">) => ({ ...p, network: p.network as SocialNetwork });

export async function listSocialPosts(): Promise<SocialPost[]> {
  const db = await getDb();
  // Publicados antigos saem da visão operacional para manter a tela leve.
  return db.select().from(socialPosts)
    .where(sql`${socialPosts.stage} <> 'publicado' OR ${socialPosts.updatedAt} > now() - interval '30 days'`)
    .orderBy(asc(socialPosts.scheduledAt), desc(socialPosts.updatedAt)).limit(300);
}

export async function createSocialPost(raw: unknown) {
  const data = socialPostSchema.parse(raw);
  const db = await getDb();
  const [row] = await db.insert(socialPosts).values({ ...data, scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null, checks: data.checks ?? {} }).returning();
  return row;
}

async function current(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(socialPosts).where(eq(socialPosts.id, z.string().uuid().parse(id)));
  if (!row) throw new Error("Post não encontrado.");
  return row;
}

export async function updateSocialPost(id: string, raw: unknown) {
  const before = await current(id);
  const data = socialPostSchema.parse(raw);
  const next = { ...data, scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null, checks: data.checks ?? {} };
  // Editar um post já aprovado não pode deixá-lo sem os requisitos de qualidade.
  const error = stageError(asQuality({ ...before, ...next }), before.stage as SocialStage);
  if (error && ["aprovado", "agendado", "publicado"].includes(before.stage)) throw new Error(error);
  const db = await getDb();
  const [row] = await db.update(socialPosts).set({ ...next, updatedAt: new Date() }).where(eq(socialPosts.id, before.id)).returning();
  return row;
}

export async function moveSocialPost(id: string, stage: SocialStage) {
  const to = z.enum(SOCIAL_STAGES).parse(stage);
  const before = await current(id);
  const error = stageError(asQuality(before), to);
  if (error) throw new Error(error);
  const db = await getDb();
  const [row] = await db.update(socialPosts).set({ stage: to, updatedAt: new Date() }).where(eq(socialPosts.id, before.id)).returning();
  return row;
}

export async function deleteSocialPost(id: string) {
  const db = await getDb();
  await db.delete(socialPosts).where(eq(socialPosts.id, z.string().uuid().parse(id)));
}
