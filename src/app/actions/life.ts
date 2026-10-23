"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { books, focusSessions, transactions, workouts } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { today } from "@/lib/dates";
import { exerciseSchema, trainingPlanSchema } from "@/lib/training";
import { settings } from "@/db/schema";

const uuid = z.string().uuid();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const refresh = () => revalidatePath("/", "layout");

/* Finanças */
const txSchema = z.object({
  date: dateStr.optional(),
  description: z.string().trim().min(1).max(200),
  kind: z.enum(["receita", "despesa"]),
  amount: z.number().positive().max(1e10),
  category: z.string().trim().min(1).max(60).optional(),
});

export async function saveTransaction(id: string | null, data: z.input<typeof txSchema>) {
  await requireAuth();
  const v = txSchema.parse(data);
  const db = await getDb();
  const values = { ...v, date: v.date ?? today(), category: v.category ?? "Outros" };
  if (id) await db.update(transactions).set(values).where(eq(transactions.id, uuid.parse(id)));
  else await db.insert(transactions).values(values);
  refresh();
}

export async function deleteTransaction(id: string) {
  await requireAuth();
  const db = await getDb();
  await db.delete(transactions).where(eq(transactions.id, uuid.parse(id)));
  refresh();
}

/* Academia */
const workoutSchema = z.object({
  date: dateStr.optional(),
  name: z.string().trim().min(1).max(160),
  minutes: z.number().int().min(0).max(1000).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  exercises: z.array(exerciseSchema).max(60).optional(),
});

export async function saveWorkout(id: string | null, data: z.input<typeof workoutSchema>) {
  await requireAuth();
  const v = workoutSchema.parse(data);
  if (v.date && (Number.isNaN(Date.parse(`${v.date}T12:00:00Z`)) || new Date(`${v.date}T12:00:00Z`).toISOString().slice(0, 10) !== v.date || v.date > today())) throw new Error("Escolha uma data válida até hoje.");
  const db = await getDb();
  const values = { ...v, date: v.date ?? today(), exercises: v.exercises ?? [] };
  if (id) await db.update(workouts).set(values).where(eq(workouts.id, uuid.parse(id)));
  else await db.insert(workouts).values(values);
  refresh();
}

export async function saveTrainingPlan(id: string | null, data: z.input<typeof trainingPlanSchema>) {
  await requireAuth();
  const value = trainingPlanSchema.parse(data);
  const planId = id ? uuid.parse(id) : crypto.randomUUID();
  const key = `training-plan:${planId}`;
  const db = await getDb();
  await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  revalidatePath("/academia");
  return planId;
}

export async function deleteTrainingPlan(id: string) {
  await requireAuth();
  const db = await getDb();
  await db.delete(settings).where(eq(settings.key, `training-plan:${uuid.parse(id)}`));
  revalidatePath("/academia");
}

export async function deleteWorkout(id: string) {
  await requireAuth();
  const db = await getDb();
  await db.delete(workouts).where(eq(workouts.id, uuid.parse(id)));
  refresh();
}

/* Leitura */
const bookSchema = z.object({
  title: z.string().trim().min(1).max(200),
  author: z.string().max(160).nullable().optional(),
  totalPages: z.number().int().min(1).max(20000).nullable().optional(),
  currentPage: z.number().int().min(0).max(20000).optional(),
  status: z.enum(["quero", "lendo", "lido"]).optional(),
});

export async function saveBook(id: string | null, data: z.input<typeof bookSchema>) {
  await requireAuth();
  const v = bookSchema.parse(data);
  const db = await getDb();
  const t = today();
  const extra = v.status === "lido" ? { finishedAt: t } : v.status === "lendo" ? { startedAt: t } : {};
  if (id) await db.update(books).set({ ...v, ...(v.status === "lido" ? { finishedAt: t } : {}) }).where(eq(books.id, uuid.parse(id)));
  else await db.insert(books).values({ ...v, ...extra });
  refresh();
}

export async function deleteBook(id: string) {
  await requireAuth();
  const db = await getDb();
  await db.delete(books).where(eq(books.id, uuid.parse(id)));
  refresh();
}

/* Foco */
export async function logFocus(minutes: number, label?: string | null, taskId?: string | null, sessionId?: string, endedAt?: string) {
  await requireAuth();
  const m = z.number().int().min(1).max(600).parse(Math.round(minutes));
  const db = await getDb();
  const end = endedAt ? new Date(z.iso.datetime({ offset: true }).parse(endedAt)).getTime() : Date.now();
  if (end > Date.now() + 60_000 || end < Date.now() - 30 * 86_400_000) throw new Error("Horário da sessão inválido");
  const rows = await db.insert(focusSessions).values({ id: sessionId ? uuid.parse(sessionId) : undefined, minutes: m, label: label ? z.string().max(200).parse(label) : null, taskId: taskId ? uuid.parse(taskId) : null, startedAt: new Date(end - m * 60_000) }).onConflictDoNothing().returning({ id: focusSessions.id });
  refresh();
  return { recorded: rows.length > 0 };
}
