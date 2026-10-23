import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { deleteEvent, saveEvent } from "@/app/actions/calendar";
import { getDb } from "@/db";
import { calendars, events } from "@/db/schema";
import { eventsBetween, syncCalendar, syncStaleCalendars } from "@/server/calendar";

vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn(async () => {}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeAll(async () => {
  const db = await getDb();
  await db.delete(events);
  await db.delete(calendars);
});
afterEach(() => vi.unstubAllGlobals());

describe("persistência da agenda", () => {
  it("cria, altera e exclui eventos locais mantendo o fim à meia-noite", async () => {
    await saveEvent(null, { title: "Revisão do ecossistema", date: "2026-10-23", endDate: "2026-10-24", startTime: "23:00", endTime: "00:00", location: "Órbita" });
    const db = await getDb();
    const [event] = await db.select().from(events).where(eq(events.title, "Revisão do ecossistema"));
    expect(event.startAt.toISOString()).toBe("2026-10-24T02:00:00.000Z");
    expect(event.endAt.toISOString()).toBe("2026-10-24T03:00:00.000Z");
    await saveEvent(event.id, { title: "Revisão concluída", date: "2026-10-23", allDay: true });
    expect((await db.select().from(events).where(eq(events.id, event.id)))[0]).toMatchObject({ title: "Revisão concluída", allDay: true });
    await deleteEvent(event.id);
    expect(await db.select().from(events).where(eq(events.id, event.id))).toHaveLength(0);
  });

  it("recusa alteração e exclusão de eventos importados no servidor", async () => {
    const db = await getDb();
    const [calendar] = await db.insert(calendars).values({ name: "iCloud", kind: "ics", url: "https://calendar.example/icloud.ics" }).returning();
    const [event] = await db.insert(events).values({ calendarId: calendar.id, title: "Origem", startAt: new Date("2026-10-23T12:00:00Z"), endAt: new Date("2026-10-23T13:00:00Z") }).returning();
    await expect(saveEvent(event.id, { title: "Tentativa", date: "2026-10-23", allDay: true })).rejects.toThrow("calendário assinado");
    await expect(deleteEvent(event.id)).rejects.toThrow("calendário assinado");
    expect((await db.select().from(events).where(eq(events.id, event.id)))[0].title).toBe("Origem");
  });

  it("reporta falha de sincronização e mantém os eventos salvos", async () => {
    const db = await getDb();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("indisponível", { status: 503 })));
    const report = await syncStaleCalendars(0);
    expect(report).toMatchObject({ synced: 0, failed: 1, events: 0 });
    expect(report.errors[0]).toMatchObject({ calendar: "iCloud" });
    expect(report.errors[0].error).toContain("503");
    const [calendar] = await db.select().from(calendars);
    expect(calendar.lastError).toContain("503");
    const saved = await eventsBetween(new Date("2026-10-23T00:00:00Z"), new Date("2026-10-24T00:00:00Z"));
    expect(saved.find((event) => event.title === "Origem")).toMatchObject({ calendarName: "iCloud", editable: false });
  });

  it("importa assinatura, mantém tarefas locais e respeita a visibilidade da origem", async () => {
    const db = await getDb();
    const [calendar] = await db.select().from(calendars);
    const now = new Date();
    const stamp = now.toISOString().slice(0, 10).replace(/-/g, "");
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:test\r\nBEGIN:VEVENT\r\nUID:importado\r\nDTSTART:${stamp}T120000Z\r\nDTEND:${stamp}T130000Z\r\nSUMMARY:Agenda conectada\r\nEND:VEVENT\r\nEND:VCALENDAR`;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(ics, { status: 200 })));
    await saveEvent(null, { title: "Evento local preservado", date: now.toISOString().slice(0, 10), allDay: true });
    expect(await syncCalendar(calendar.id)).toBe(1);
    expect((await db.select().from(calendars).where(eq(calendars.id, calendar.id)))[0]).toMatchObject({ lastError: null });
    const from = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
    const to = new Date(from.getTime() + 86_400_000);
    expect((await eventsBetween(from, to)).map((event) => event.title)).toContain("Agenda conectada");
    await db.update(calendars).set({ enabled: false }).where(eq(calendars.id, calendar.id));
    const visible = (await eventsBetween(from, to)).map((event) => event.title);
    expect(visible).not.toContain("Agenda conectada");
    expect(visible).toContain("Evento local preservado");
  });
});
