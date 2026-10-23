import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { COVER_PRESETS } from "@/lib/covers";

export type Cover = { url: string; author?: string; authorUrl?: string; source?: string; color?: string };

export const WIDGETS = [
  { id: "plano", label: "Plano do dia" },
  { id: "checkin", label: "Como foi hoje?" },
  { id: "conquistas", label: "Metas & Conquistas" },
  { id: "metas", label: "Metas" },
  { id: "habitos", label: "Hábitos de hoje" },
  { id: "tarefas", label: "Tarefas" },
  { id: "agenda", label: "Agenda" },
  { id: "operacao", label: "Operação" },
  { id: "foco", label: "Tempo de foco" },
  { id: "treino", label: "Último treino" },
  { id: "financas", label: "Finanças do mês" },
  { id: "leitura", label: "Leitura" },
] as const;
export type WidgetId = (typeof WIDGETS)[number]["id"];

export const THEMES = ["grafite", "meia-noite", "ameixa", "floresta", "areia"] as const;
export type ThemeId = (typeof THEMES)[number];
export const SURFACES = ["solido", "vidro"] as const;
export type SurfaceId = (typeof SURFACES)[number];

export type AppSettings = {
  name: string;
  accent: string;
  theme: ThemeId;
  surface: SurfaceId;
  cover: Cover;
  widgets: { order: WidgetId[]; hidden: WidgetId[] };
  focusMinutes: number;
};

export const DEFAULT_COVER: Cover = {
  url: COVER_PRESETS[0].url,
  author: COVER_PRESETS[0].author,
  authorUrl: COVER_PRESETS[0].authorUrl,
  source: "unsplash",
  color: COVER_PRESETS[0].color,
};

export const DEFAULT_SETTINGS: AppSettings = {
  name: process.env.OWNER_NAME ?? "Antonio Garcia",
  accent: "cyan",
  theme: "grafite",
  surface: "solido",
  cover: DEFAULT_COVER,
  widgets: {
    order: ["conquistas", "habitos", "metas", "tarefas", "agenda", "plano", "checkin", "operacao", "foco", "treino", "financas", "leitura"],
    hidden: ["leitura"],
  },
  focusMinutes: 25,
};

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb();
  const rows = await db.select().from(settings);
  // só as chaves de preferência (a tabela também guarda segurança e a foto, que não devem vazar daqui)
  const keys = new Set(Object.keys(DEFAULT_SETTINGS));
  const map = Object.fromEntries(rows.filter((r) => keys.has(r.key)).map((r) => [r.key, r.value])) as Partial<AppSettings>;
  const merged = { ...DEFAULT_SETTINGS, ...map };
  // garante que widgets novos apareçam para quem já tinha uma ordem salva
  const known = new Set(merged.widgets.order);
  for (const w of DEFAULT_SETTINGS.widgets.order) if (!known.has(w)) merged.widgets.order.push(w);
  return merged;
}

export async function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  const db = await getDb();
  await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}

export async function deleteSettings(keys: (keyof AppSettings)[]) {
  const db = await getDb();
  if (keys.length) await db.delete(settings).where(inArray(settings.key, keys));
}

export async function getRawSetting(key: string) {
  const db = await getDb();
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  return row?.value;
}

/* ───────────── Foto do perfil (guardada no banco, servida por /api/avatar) ───────────── */

type StoredAvatar = { type: string; data: string; updatedAt: number };

export async function getAvatar(): Promise<StoredAvatar | null> {
  const v = (await getRawSetting("avatar")) as StoredAvatar | null | undefined;
  return v && typeof v.data === "string" ? v : null;
}

/** Versão da foto (para invalidar o cache do navegador) ou null se não houver. */
export async function avatarVersion(): Promise<number | null> {
  const db = await getDb();
  const [row] = await db.select({ v: sql<number | null>`(${settings.value}->>'updatedAt')::bigint` }).from(settings).where(eq(settings.key, "avatar"));
  return row?.v ? Number(row.v) : null;
}

export async function setAvatar(value: StoredAvatar | null) {
  const db = await getDb();
  if (!value) await db.delete(settings).where(eq(settings.key, "avatar"));
  else await db.insert(settings).values({ key: "avatar", value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}
