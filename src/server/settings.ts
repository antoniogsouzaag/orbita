import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { COVER_PRESETS } from "@/lib/covers";

export type Cover = { url: string; author?: string; authorUrl?: string; source?: string; color?: string };

export const WIDGETS = [
  { id: "prioridades", label: "Próxima ação" },
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

/** Cards do Início da Empresa. */
export const EMPRESA_WIDGETS = [
  { id: "aguardando", label: "Aguardando você" },
  { id: "operacao", label: "Operação agora" },
  { id: "tarefas", label: "Tarefas da empresa" },
  { id: "crm", label: "CRM" },
  { id: "github", label: "GitHub — PRs e propostas" },
  { id: "agentes", label: "Atividade dos agentes" },
  { id: "projetos", label: "Projetos" },
  { id: "incidentes", label: "Incidentes e falhas" },
  { id: "dominios", label: "Domínios" },
  { id: "metas", label: "Metas da empresa" },
  { id: "agenda", label: "Agenda" },
] as const;
export type EmpresaWidgetId = (typeof EMPRESA_WIDGETS)[number]["id"];

export type AppSettings = {
  name: string;
  accent: string;
  cover: Cover;
  widgets: { order: WidgetId[]; hidden: WidgetId[] };
  empresaCover: Cover;
  empresaWidgets: { order: EmpresaWidgetId[]; hidden: EmpresaWidgetId[] };
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
  cover: DEFAULT_COVER,
  widgets: {
    order: ["conquistas", "prioridades", "habitos", "metas", "tarefas", "agenda", "plano", "checkin", "operacao", "foco", "treino", "financas", "leitura"],
    hidden: ["leitura"],
  },
  empresaCover: {
    url: COVER_PRESETS.find((c) => c.id === "city2")?.url ?? COVER_PRESETS[1].url,
    author: COVER_PRESETS.find((c) => c.id === "city2")?.author ?? COVER_PRESETS[1].author,
    authorUrl: COVER_PRESETS.find((c) => c.id === "city2")?.authorUrl ?? COVER_PRESETS[1].authorUrl,
    source: "unsplash",
    color: COVER_PRESETS.find((c) => c.id === "city2")?.color ?? COVER_PRESETS[1].color,
  },
  empresaWidgets: {
    order: ["aguardando", "operacao", "tarefas", "crm", "github", "agentes", "projetos", "incidentes", "dominios", "metas", "agenda"],
    hidden: ["agenda"],
  },
  focusMinutes: 25,
};

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb();
  const rows = await db.select().from(settings).where(inArray(settings.key, Object.keys(DEFAULT_SETTINGS)));
  // só as chaves de preferência (a tabela também guarda segurança e a foto, que não devem vazar daqui)
  const keys = new Set(Object.keys(DEFAULT_SETTINGS));
  const map = Object.fromEntries(rows.filter((r) => keys.has(r.key)).map((r) => [r.key, r.value])) as Partial<AppSettings>;
  const merged = structuredClone({ ...DEFAULT_SETTINGS, ...map });
  // garante que widgets novos apareçam para quem já tinha uma ordem salva
  const known = new Set(merged.widgets.order);
  for (const w of DEFAULT_SETTINGS.widgets.order) if (!known.has(w)) {
    if (w === "prioridades") merged.widgets.order.splice(Math.max(0, merged.widgets.order.indexOf("conquistas") + 1), 0, w);
    else merged.widgets.order.push(w);
  }
  const knownE = new Set(merged.empresaWidgets.order);
  for (const w of DEFAULT_SETTINGS.empresaWidgets.order) if (!knownE.has(w)) merged.empresaWidgets.order.push(w);
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
