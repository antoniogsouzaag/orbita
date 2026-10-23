"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { calendars, events } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { eventFormSchema, eventRange } from "@/lib/calendar";
import { syncCalendar, syncStaleCalendars } from "@/server/calendar";

async function requireEditableEvent(id: string) {
  const db = await getDb();
  const [event] = await db.select({ id: events.id, calendarId: events.calendarId, kind: calendars.kind }).from(events).leftJoin(calendars, eq(events.calendarId, calendars.id)).where(eq(events.id, z.string().uuid().parse(id)));
  if (!event) throw new Error("Evento não encontrado");
  if (event.calendarId && event.kind !== "local") throw new Error("Este evento pertence a um calendário assinado. Edite-o na origem.");
}

export async function saveEvent(id: string | null, data: z.input<typeof eventFormSchema>) {
  await requireAuth();
  const v = eventFormSchema.parse(data);
  const db = await getDb();
  const values = { title: v.title, location: v.location ?? null, description: v.description ?? null, color: v.color ?? null, ...eventRange(v) };
  if (id) {
    await requireEditableEvent(id);
    await db.update(events).set(values).where(eq(events.id, id));
  }
  else await db.insert(events).values(values);
  revalidatePath("/", "layout");
}

export async function deleteEvent(id: string) {
  await requireAuth();
  await requireEditableEvent(id);
  const db = await getDb();
  await db.delete(events).where(eq(events.id, z.string().uuid().parse(id)));
  revalidatePath("/", "layout");
}

export async function addIcsCalendar(data: { name: string; url: string; color?: string }) {
  await requireAuth();
  const v = z
    .object({ name: z.string().trim().min(1).max(80), url: z.string().trim().regex(/^(https?|webcals?):\/\//i, "Use um link https:// ou webcal://").max(2000), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() })
    .parse(data);
  const db = await getDb();
  const [cal] = await db.insert(calendars).values({ name: v.name, url: v.url, color: v.color ?? "#22c55e", kind: "ics" }).returning({ id: calendars.id });
  let count = 0;
  let error: string | null = null;
  try {
    count = await syncCalendar(cal.id);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  revalidatePath("/", "layout");
  return { count, error };
}

export async function resyncCalendar(id: string) {
  await requireAuth();
  try {
    const count = await syncCalendar(z.string().uuid().parse(id));
    revalidatePath("/", "layout");
    return { count, error: null };
  } catch (e) {
    revalidatePath("/", "layout");
    return { count: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function resyncCalendars() {
  await requireAuth();
  const report = await syncStaleCalendars(0);
  revalidatePath("/", "layout");
  return report;
}

export async function updateCalendar(id: string, data: { enabled?: boolean; color?: string; name?: string }) {
  await requireAuth();
  const v = z.object({ enabled: z.boolean().optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), name: z.string().trim().min(1).max(80).optional() }).parse(data);
  const db = await getDb();
  await db.update(calendars).set(v).where(eq(calendars.id, z.string().uuid().parse(id)));
  revalidatePath("/", "layout");
}

export async function deleteCalendar(id: string) {
  await requireAuth();
  const db = await getDb();
  await db.delete(calendars).where(eq(calendars.id, z.string().uuid().parse(id)));
  revalidatePath("/", "layout");
}
