import "server-only";
import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { orbeConversations, type OrbeConversation, type TaskScope } from "@/db/schema";

/**
 * Conversas da ORBE guardadas no servidor (continuam em outro aparelho).
 * Ficam por um tempo limitado: antes de expirar, a consolidação diária
 * leva para a memória o que for durável e ainda não estiver lá.
 */
export const CONVERSATION_RETENTION_DAYS = 60;
export const CONVERSATIONS_PER_SCOPE = 50;
const MAX_BYTES = 400_000;

const message = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(20000),
}).passthrough();
export const conversationInput = z.object({
  scope: z.enum(["pessoal", "empresa"]),
  messages: z.array(message).max(200),
});

export type ConversationSummary = Pick<OrbeConversation, "id" | "title" | "scope" | "updatedAt">;

function titleOf(messages: { role: string; content: string }[]) {
  const first = messages.find((m) => m.role === "user")?.content.replace(/\s+/g, " ").trim() ?? "Conversa";
  return first.length > 80 ? `${first.slice(0, 77)}…` : first;
}

/** Cria ou atualiza; uma conversa nunca muda de espaço. */
export async function saveConversation(id: string, raw: z.input<typeof conversationInput>) {
  const convId = z.uuid().parse(id);
  const input = conversationInput.parse(raw);
  if (JSON.stringify(input.messages).length > MAX_BYTES) throw new Error("Conversa grande demais; comece uma nova.");
  const db = await getDb();
  const [existing] = await db.select({ scope: orbeConversations.scope }).from(orbeConversations).where(eq(orbeConversations.id, convId));
  if (existing && existing.scope !== input.scope) throw new Error("Conversa de outro espaço.");
  const values = { title: titleOf(input.messages), messages: input.messages, updatedAt: new Date() };
  if (existing) await db.update(orbeConversations).set(values).where(eq(orbeConversations.id, convId));
  else await db.insert(orbeConversations).values({ id: convId, scope: input.scope, ...values });
}

export async function listConversations(scope: TaskScope, limit = CONVERSATIONS_PER_SCOPE): Promise<ConversationSummary[]> {
  const db = await getDb();
  return db.select({ id: orbeConversations.id, title: orbeConversations.title, scope: orbeConversations.scope, updatedAt: orbeConversations.updatedAt })
    .from(orbeConversations).where(eq(orbeConversations.scope, scope)).orderBy(desc(orbeConversations.updatedAt)).limit(limit);
}

export async function getConversation(id: string, scope: TaskScope) {
  const db = await getDb();
  const [row] = await db.select().from(orbeConversations).where(and(eq(orbeConversations.id, z.uuid().parse(id)), eq(orbeConversations.scope, scope)));
  return row ?? null;
}

export async function deleteConversation(id: string, scope: TaskScope) {
  const db = await getDb();
  await db.delete(orbeConversations).where(and(eq(orbeConversations.id, z.uuid().parse(id)), eq(orbeConversations.scope, scope)));
}

/** Texto simples da conversa (sem marcadores, recibos ou etapas). */
export function transcript(messages: unknown[], max = 24000) {
  const lines = messages.flatMap((m) => {
    const v = m as { role?: string; content?: unknown };
    return typeof v.content === "string" && v.content.trim() ? [`${v.role === "user" ? "Antonio" : "ORBE"}: ${v.content.trim()}`] : [];
  });
  const text = lines.join("\n\n");
  return text.length > max ? `…${text.slice(-max)}` : text;
}

/** Busca em conversas anteriores do mesmo espaço, como a busca de sessões do Hermes. */
export async function searchConversations(scope: TaskScope, query: string, limit = 5) {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length >= 3).slice(0, 6);
  if (!terms.length) return [];
  const db = await getDb();
  const text = sql`lower(${orbeConversations.messages}::text)`;
  const rows = await db.select().from(orbeConversations)
    .where(and(eq(orbeConversations.scope, scope), or(...terms.map((t) => sql`position(${t} in ${text}) > 0`))))
    .orderBy(desc(orbeConversations.updatedAt)).limit(limit);
  return rows.map((r) => {
    const body = transcript(r.messages, 200_000);
    const lower = body.toLowerCase();
    const at = Math.max(0, Math.min(...terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0)));
    return { id: r.id, title: r.title, updatedAt: r.updatedAt, excerpt: body.slice(Math.max(0, at - 300), at + 500) };
  });
}

/** Conversas alteradas desde a última consolidação (paradas há pelo menos 1 h). */
export async function conversationsToConsolidate(limit = 20) {
  const db = await getDb();
  const idle = new Date(Date.now() - 3_600_000);
  return db.select().from(orbeConversations)
    .where(and(lt(orbeConversations.updatedAt, idle), or(isNull(orbeConversations.consolidatedAt), lt(orbeConversations.consolidatedAt, orbeConversations.updatedAt))))
    .orderBy(orbeConversations.updatedAt).limit(limit);
}

export async function markConsolidated(id: string, at = new Date()) {
  const db = await getDb();
  await db.update(orbeConversations).set({ consolidatedAt: at }).where(eq(orbeConversations.id, id));
}

/** Apaga só o que expirou E já foi consolidado depois da última mudança. */
export async function expireConversations(now = Date.now()) {
  const db = await getDb();
  const cutoff = new Date(now - CONVERSATION_RETENTION_DAYS * 86_400_000);
  const consolidated = sql`${orbeConversations.consolidatedAt} is not null and ${orbeConversations.consolidatedAt} >= ${orbeConversations.updatedAt}`;
  const old = await db.delete(orbeConversations).where(and(lt(orbeConversations.updatedAt, cutoff), consolidated)).returning({ id: orbeConversations.id });
  // Além do limite por espaço, as mais antigas saem (também só depois de consolidadas).
  let extra = 0;
  for (const scope of ["pessoal", "empresa"] as const) {
    const keep = await db.select({ id: orbeConversations.id }).from(orbeConversations).where(eq(orbeConversations.scope, scope)).orderBy(desc(orbeConversations.updatedAt)).limit(CONVERSATIONS_PER_SCOPE);
    const keepIds = keep.map((k) => k.id);
    if (keep.length < CONVERSATIONS_PER_SCOPE) continue;
    const removed = await db.delete(orbeConversations).where(and(eq(orbeConversations.scope, scope), consolidated, sql`not (${inArray(orbeConversations.id, keepIds)})`)).returning({ id: orbeConversations.id });
    extra += removed.length;
  }
  return old.length + extra;
}
