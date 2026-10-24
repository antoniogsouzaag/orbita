import "server-only";
import { eq, inArray, like, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { DIRECTORS } from "@/lib/team";

/* Fotos dos agentes: guardadas no banco (uma chave por agente), servidas por /api/agents/<id>/avatar. */

export type StoredAgentAvatar = { type: string; data: string; updatedAt: number };

const PREFIX = "agent-avatar:";
export const AGENT_ID = /^[a-z0-9][a-z0-9-]{0,59}$/;

export async function getAgentAvatar(id: string): Promise<StoredAgentAvatar | null> {
  if (!AGENT_ID.test(id)) return null;
  const db = await getDb();
  const [row] = await db.select().from(settings).where(eq(settings.key, PREFIX + id));
  const v = row?.value as StoredAgentAvatar | undefined;
  return v && typeof v.data === "string" ? v : null;
}

export async function setAgentAvatar(id: string, value: StoredAgentAvatar | null) {
  if (!AGENT_ID.test(id)) throw new Error("Agente inválido");
  const db = await getDb();
  if (!value) await db.delete(settings).where(eq(settings.key, PREFIX + id));
  else await db.insert(settings).values({ key: PREFIX + id, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  // Foto gravada num id antigo do mesmo diretor (ex.: oracle) deixa de valer ao trocar ou remover.
  const aliases = DIRECTORS.find((d) => d.id === id)?.aliases ?? [];
  if (aliases.length) await db.delete(settings).where(inArray(settings.key, aliases.map((a) => PREFIX + a)));
}

/** URL versionada da foto de cada agente que tem uma (sem trazer as imagens). */
export async function agentAvatarUrls(): Promise<Map<string, string>> {
  const db = await getDb();
  const rows = await db
    .select({ key: settings.key, v: sql<number | null>`(${settings.value}->>'updatedAt')::bigint` })
    .from(settings)
    .where(like(settings.key, `${PREFIX}%`));
  return new Map(rows.filter((r) => r.v).map((r) => {
    const id = r.key.slice(PREFIX.length);
    return [id, `/api/agents/${id}/avatar?v=${Number(r.v)}`];
  }));
}
