"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { calendars, events } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { shiftDate, zonedToUtc } from "@/lib/dates";
import { syncCalendar } from "@/server/calendar";

const eventSchema = z.object({
  title: z.string().trim().min(1).max(300),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  allDay: z.boolean().optional(),
  location: z.string().max(300).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
});

function toRange(v: z.infer<typeof eventSchema>) {
  const allDay = v.allDay || !v.startTime;
  if (allDay) {
    const start = new Date(`${v.date}T00:00:00Z`);
    const end = new Date(`${shiftDate(v.endDate ?? v.date, 1)}T00:00:00Z`);
    return { startAt: start, endAt: end, allDay: true };
  }
  const startAt = zonedToUtc(v.date, v.startTime!);
  let endAt = v.endTime ? zonedToUtc(v.endDate ?? v.date, v.endTime) : new Date(startAt.getTime() + 3_600_000);
  if (endAt <= startAt) endAt = new Date(startAt.getTime() + 3_600_000);
  return { startAt, endAt, allDay: false };
}

export async function saveEvent(id: string | null, data: z.input<typeof eventSchema>) {
  await requireAuth();
  const v = eventSchema.parse(data);
  const db = await getDb();
  const values = { title: v.title, location: v.location ?? null, description: v.description ?? null, color: v.color ?? null, ...toRange(v) };
  if (id) await db.update(events).set(values).where(eq(events.id, z.string().uuid().parse(id)));
  else await db.insert(events).values(values);
  revalidatePath("/", "layout");
}

export async function deleteEvent(id: string) {
  await requireAuth();
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
