"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { AREAS, TASK_SCOPES, TASK_STATUS, checkins, goals, habitLogs, habits, notes, projects, tasks } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { today } from "@/lib/dates";
import { matchProject, parseTaskInput } from "@/lib/parse-task";
import { setAvatar, setSetting, type AppSettings } from "@/server/settings";

function refresh() {
  revalidatePath("/", "layout");
}

const uuid = z.string().uuid();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeStr = z.string().regex(/^\d{2}:\d{2}$/);

/* ───────────── Tarefas ───────────── */

export async function quickAddTask(raw: string, projectId?: string | null, scope?: "pessoal" | "empresa") {
  await requireAuth();
  const input = z.string().trim().min(1).max(500).parse(raw);
  const db = await getDb();
  const parsed = parseTaskInput(input, today());
  let pid = projectId ? uuid.parse(projectId) : null;
  let projectName: string | null = null;
  let projectArea: string | null = null;
  if (parsed.projectQuery) {
    const all = await db.select({ id: projects.id, name: projects.name, area: projects.area }).from(projects).where(eq(projects.archived, false));
    const p = matchProject(parsed.projectQuery, all);
    if (p) {
      pid = p.id;
      projectName = p.name;
      projectArea = all.find((x) => x.id === p.id)?.area ?? null;
    } else parsed.title = `${parsed.title} @${parsed.projectQuery}`.trim();
  }
  if (!parsed.title) parsed.title = input;
  const [row] = await db
    .insert(tasks)
    .values({ title: parsed.title, tags: parsed.tags, priority: parsed.priority, dueDate: parsed.dueDate, dueTime: parsed.dueTime, projectId: pid, scope: z.enum(TASK_SCOPES).catch("pessoal").parse(scope ?? (projectArea === "empresa" ? "empresa" : "pessoal")) })
    .returning({ id: tasks.id });
  refresh();
  return { id: row.id, parsed: { ...parsed, projectName } };
}

const taskSchema = z.object({
  title: z.string().trim().min(1).max(500),
  notes: z.string().max(20000).nullable().optional(),
  projectId: uuid.nullable().optional(),
  parentId: uuid.nullable().optional(),
  status: z.enum(TASK_STATUS).optional(),
  scope: z.enum(TASK_SCOPES).optional(),
  priority: z.number().int().min(0).max(3).optional(),
  dueDate: dateStr.nullable().optional(),
  dueTime: timeStr.nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

export async function createTask(data: z.input<typeof taskSchema>) {
  await requireAuth();
  const v = taskSchema.parse(data);
  const db = await getDb();
  const [row] = await db.insert(tasks).values({ ...v, completedAt: v.status === "done" ? new Date() : null }).returning({ id: tasks.id });
  refresh();
  return row.id;
}

export async function updateTask(id: string, patch: Partial<z.input<typeof taskSchema>>) {
  await requireAuth();
  const v = taskSchema.partial().parse(patch);
  const db = await getDb();
  const extra = v.status ? { completedAt: v.status === "done" ? new Date() : null } : {};
  await db.update(tasks).set({ ...v, ...extra }).where(eq(tasks.id, uuid.parse(id)));
  refresh();
}

export async function toggleTask(id: string) {
  await requireAuth();
  const db = await getDb();
  await db
    .update(tasks)
    .set({
      status: sql`case when ${tasks.status} = 'done' then 'todo' else 'done' end`,
      completedAt: sql`case when ${tasks.status} = 'done' then null else now() end`,
    })
    .where(eq(tasks.id, uuid.parse(id)));
  refresh();
}

export async function deleteTask(id: string) {
  await requireAuth();
  const db = await getDb();
  await db.delete(tasks).where(eq(tasks.id, uuid.parse(id)));
  refresh();
}

/* ───────────── Projetos ───────────── */

const projectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(8).nullable().optional(),
  area: z.enum(AREAS).optional(),
  archived: z.boolean().optional(),
});

export async function saveProject(id: string | null, data: z.input<typeof projectSchema>) {
  await requireAuth();
  const v = projectSchema.parse(data);
  const db = await getDb();
  if (id) await db.update(projects).set(v).where(eq(projects.id, uuid.parse(id)));
  else await db.insert(projects).values(v);
  refresh();
}

export async function deleteProject(id: string) {
  await requireAuth();
  const db = await getDb();
  await db.delete(projects).where(eq(projects.id, uuid.parse(id)));
  refresh();
}

/* ───────────── Hábitos ───────────── */

const habitSchema = z.object({
  name: z.string().trim().min(1).max(120),
  emoji: z.string().max(16).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  area: z.enum(AREAS).optional(),
  frequency: z.enum(["daily", "weekly"]).optional(),
  timesPerWeek: z.number().int().min(1).max(7).optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  goalId: uuid.nullable().optional(),
  archived: z.boolean().optional(),
});

export async function saveHabit(id: string | null, data: z.input<typeof habitSchema>) {
  await requireAuth();
  const v = habitSchema.parse(data);
  const db = await getDb();
  if (id) await db.update(habits).set(v).where(eq(habits.id, uuid.parse(id)));
  else await db.insert(habits).values(v);
  refresh();
}

export async function deleteHabit(id: string) {
  await requireAuth();
  const db = await getDb();
  await db.delete(habits).where(eq(habits.id, uuid.parse(id)));
  refresh();
}

export async function toggleHabit(id: string, date?: string) {
  await requireAuth();
  const habitId = uuid.parse(id);
  const d = date ? dateStr.parse(date) : today();
  if (d > today()) throw new Error("Não é possível marcar dias futuros");
  const db = await getDb();
  const removed = await db
    .delete(habitLogs)
    .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, d)))
    .returning({ habitId: habitLogs.habitId });
  if (removed.length === 0) await db.insert(habitLogs).values({ habitId, date: d }).onConflictDoNothing();
  refresh();
  return removed.length === 0;
}

/* ───────────── Metas ───────────── */

const goalSchema = z.object({
  title: z.string().trim().min(1).max(200),
  emoji: z.string().max(16).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  area: z.enum(AREAS).optional(),
  metric: z.enum(["percent", "number", "currency"]).optional(),
  current: z.number().min(-1e12).max(1e12).optional(),
  target: z.number().min(0).max(1e12).optional(),
  unit: z.string().max(20).nullable().optional(),
  dueDate: dateStr.nullable().optional(),
  status: z.enum(["ativa", "pausada", "concluida"]).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function saveGoal(id: string | null, data: z.input<typeof goalSchema>) {
  await requireAuth();
  const v = goalSchema.parse(data);
  const db = await getDb();
  if (id) await db.update(goals).set(v).where(eq(goals.id, uuid.parse(id)));
  else await db.insert(goals).values(v);
  refresh();
}

export async function deleteGoal(id: string) {
  await requireAuth();
  const db = await getDb();
  await db.delete(goals).where(eq(goals.id, uuid.parse(id)));
  refresh();
}

/* ───────────── Notas ───────────── */

export async function createNote(title?: string, content?: string) {
  await requireAuth();
  const db = await getDb();
  const [n] = await db
    .insert(notes)
    .values({ title: z.string().trim().max(200).parse(title || "Sem título") || "Sem título", content: z.string().max(200000).parse(content ?? "") })
    .returning({ id: notes.id });
  refresh();
  return n.id;
}

export async function saveNote(id: string, data: { title?: string; content?: string; pinned?: boolean; tags?: string[] }) {
  await requireAuth();
  const v = z
    .object({ title: z.string().trim().max(200).optional(), content: z.string().max(200000).optional(), pinned: z.boolean().optional(), tags: z.array(z.string().max(40)).max(30).optional() })
    .parse(data);
  const db = await getDb();
  await db.update(notes).set({ ...v, updatedAt: new Date() }).where(eq(notes.id, uuid.parse(id)));
  revalidatePath("/notas");
}

export async function deleteNote(id: string) {
  await requireAuth();
  const db = await getDb();
  await db.delete(notes).where(eq(notes.id, uuid.parse(id)));
  refresh();
}

/* ───────────── Check-in diário ───────────── */

export async function saveCheckin(data: { date?: string; mood?: number | null; energy?: number | null; note?: string | null }) {
  await requireAuth();
  const v = z
    .object({ date: dateStr.optional(), mood: z.number().int().min(1).max(5).nullable().optional(), energy: z.number().int().min(1).max(5).nullable().optional(), note: z.string().max(2000).nullable().optional() })
    .parse(data);
  const date = v.date ?? today();
  const db = await getDb();
  const set = { ...("mood" in v ? { mood: v.mood } : {}), ...("energy" in v ? { energy: v.energy } : {}), ...("note" in v ? { note: v.note } : {}), updatedAt: new Date() };
  await db.insert(checkins).values({ date, ...set }).onConflictDoUpdate({ target: checkins.date, set });
  refresh();
}

/* ───────────── Configurações ───────────── */

export async function updateSettings(patch: Partial<AppSettings>) {
  await requireAuth();
  const v = z
    .object({
      name: z.string().trim().min(1).max(80).optional(),
      accent: z.enum(["cyan", "orange", "blue", "violet", "green", "rose", "white"]).optional(),
      cover: z.object({ url: z.string().url().max(2000), author: z.string().max(120).optional(), authorUrl: z.string().url().max(500).optional(), source: z.string().max(40).optional(), color: z.string().max(20).optional() }).optional(),
      widgets: z.object({ order: z.array(z.string()).max(40), hidden: z.array(z.string()).max(40) }).optional(),
      focusMinutes: z.number().int().min(5).max(180).optional(),
    })
    .parse(patch);
  for (const [k, val] of Object.entries(v)) await setSetting(k as keyof AppSettings, val as never);
  refresh();
}

/** Foto do perfil: recebe a imagem já recortada e reduzida no navegador (data URL). null remove. */
export async function saveAvatar(dataUrl: string | null) {
  await requireAuth();
  if (dataUrl === null) {
    await setAvatar(null);
    refresh();
    return { ok: true as const };
  }
  const m = /^data:(image\/(?:webp|png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(z.string().max(700_000).parse(dataUrl));
  if (!m) return { ok: false as const, error: "Formato de imagem não suportado" };
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > 400_000) return { ok: false as const, error: "Imagem grande demais" };
  const magic = bytes.subarray(0, 12).toString("latin1");
  const valid = (m[1] === "image/png" && magic.startsWith("\x89PNG")) || (m[1] === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8) || (m[1] === "image/webp" && magic.startsWith("RIFF") && magic.slice(8, 12) === "WEBP");
  if (!valid) return { ok: false as const, error: "Arquivo de imagem inválido" };
  await setAvatar({ type: m[1], data: m[2], updatedAt: Date.now() });
  refresh();
  return { ok: true as const };
}

/* ───────────── Atalho do iPhone ───────────── */

export async function generateCaptureToken() {
  await requireAuth();
  const { createCaptureToken } = await import("@/server/capture");
  return createCaptureToken();
}

export async function revokeCaptureTokenAction() {
  await requireAuth();
  const { revokeCaptureToken } = await import("@/server/capture");
  await revokeCaptureToken();
  refresh();
}

/* ───────────── Telegram ───────────── */

export async function sendBriefNow(): Promise<{ ok: boolean; error?: string }> {
  await requireAuth();
  const [{ buildBrief }, { sendTelegram }] = await Promise.all([import("@/server/brief"), import("@/server/telegram")]);
  return sendTelegram(await buildBrief());
}
