import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { appointments, appointmentHistory, appointmentRequests, calendars, events } from "@/db/schema";
import { maiaAppointment, ownerAppointment } from "@/server/appointments";

const base = new Date("2026-11-05T09:00:00Z");
const contact_id = "11111111-1111-4111-8111-111111111111";
const request = (operation: string, args = {}) => ({ version: 1, contact_id, operation, args, request_id: randomUUID() });
const booking = (start_at = "2026-11-05T11:00:00Z", mode = "remote") => request("book", { start_at, mode, subject: "SYNTHETIC", ...(mode === "in_person" ? { address: "SYNTHETIC" } : {}) });
const fixtureClock = () => new Date("2026-11-05T00:00:00Z");

it.each(["book", "reschedule", "approve"])("%s rolls back if its first write wait expires the slot before the reservation write", async operation => {
  const db = await getDb();
  let ownerId = "";
  if (operation !== "book") {
    const seed = await maiaAppointment(booking(operation === "approve" ? "2026-11-05T11:00:00Z" : "2026-11-06T11:00:00Z", operation === "approve" ? "in_person" : "remote"), fixtureClock);
    if (!("appointment" in seed)) throw new Error("missing appointment");
    ownerId = seed.appointment.id;
  }
  const before = await snapshot();
  let reads = 0;
  const clock = () => new Date(base.getTime() + (++reads >= 3 ? 1 : 0));
  const work = operation === "approve"
    ? ownerAppointment({ id: ownerId, version: 1, operation: "approve", travel_before: 0, travel_after: 0 }, clock)
    : maiaAppointment(operation === "book" ? booking() : request("reschedule", { appointment_id: ownerId, start_at: "2026-11-05T11:00:00Z" }), clock);
  await expect(work).rejects.toThrow("invalid_slot");
  expect(await snapshot()).toBe(before);
  expect(await db.select().from(events)).toHaveLength(operation === "reschedule" ? 1 : 0);
});

it.each(["book", "reschedule", "approve"])("%s honors inclusive 2h/14d boundaries with a clock provider", async operation => {
  for (const [start, decision, valid] of [
    ["2026-11-05T11:00:00Z", "2026-11-05T09:00:00Z", true],
    ["2026-11-05T11:00:00Z", "2026-11-05T09:00:00.001Z", false],
    ["2026-11-19T11:00:00Z", "2026-11-05T11:00:00Z", true],
    ["2026-11-19T11:00:00Z", "2026-11-05T10:59:59.999Z", false],
  ] as const) {
    const db = await getDb();
    await db.delete(appointmentHistory); await db.delete(appointmentRequests); await db.delete(appointments); await db.delete(events);
    let input = booking(start);
    let ownerId = "";
    if (operation !== "book") {
      const seed = await maiaAppointment(booking(operation === "approve" ? start : "2026-11-06T11:00:00Z", operation === "approve" ? "in_person" : "remote"), operation === "approve" ? () => new Date(new Date(start).getTime() - 7200000) : fixtureClock);
      if (!("appointment" in seed)) throw new Error("missing appointment");
      ownerId = seed.appointment.id;
      input = request("reschedule", { appointment_id: ownerId, start_at: start });
    }
    const clock = () => new Date(decision);
    const result = operation === "approve"
      ? ownerAppointment({ id: ownerId, version: 1, operation: "approve", travel_before: 0, travel_after: 0 }, clock)
      : maiaAppointment(input, clock);
    if (valid) await expect(result).resolves.toMatchObject(operation === "approve" ? { state: "confirmed" } : { ok: true });
    else await expect(result).rejects.toThrow("invalid_slot");
  }
});

it("historical book and reschedule receipts replay after the slot expires without refreshing calendars", async () => {
  const input = booking();
  const first = await maiaAppointment(input, fixtureClock);
  if (!("appointment" in first)) throw new Error("missing appointment");
  const move = request("reschedule", { appointment_id: first.appointment.id, start_at: "2026-11-05T12:00:00Z" });
  const moved = await maiaAppointment(move, fixtureClock);
  await slowFeed();
  vi.setSystemTime(new Date("2026-12-01T09:00:00Z"));
  const before = await snapshot();
  expect(await maiaAppointment(input)).toEqual({ ...first, repeated: true });
  expect(await maiaAppointment(move)).toEqual({ ...moved, repeated: true });
  expect(fetch).not.toHaveBeenCalled();
  expect(await snapshot()).toBe(before);
});

beforeEach(async () => {
  const db = await getDb();
  await db.delete(appointmentHistory); await db.delete(appointmentRequests); await db.delete(appointments);
  await db.delete(events); await db.delete(calendars);
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(base);
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
async function slowFeed() {
  await (await getDb()).insert(calendars).values({ name: "SYNTHETIC", kind: "ics", url: "https://fixture.invalid" });
  vi.stubGlobal("fetch", vi.fn(async () => {
    vi.setSystemTime(new Date(base.getTime() + 19000));
    return new Response("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR");
  }));
}

it("availability excludes the inclusive two-hour slot after refresh advances the production clock", async () => {
  await slowFeed();
  const result = await maiaAppointment(request("availability"));
  expect(result).toMatchObject({ slots: [
    { start_at: "2026-11-05T12:00:00.000Z" }, { start_at: "2026-11-05T13:00:00.000Z" },
  ] });
});

it("book rejects an expired slot after refresh without committing reservation or receipt", async () => {
  await slowFeed();
  await expect(maiaAppointment(booking())).rejects.toThrow("invalid_slot");
  const db = await getDb();
  expect(await db.select().from(appointments)).toHaveLength(0);
  expect(await db.select().from(events)).toHaveLength(0);
  expect(await db.select().from(appointmentHistory)).toHaveLength(0);
  expect(await db.select().from(appointmentRequests)).toHaveLength(0);
});

async function snapshot() {
  const db = await getDb();
  return JSON.stringify({ appointments: await db.select().from(appointments), events: await db.select().from(events), history: await db.select().from(appointmentHistory), requests: await db.select().from(appointmentRequests) });
}
it("reschedule rejects an expired target after refresh and preserves every old row", async () => {
  const first = await maiaAppointment(booking("2026-11-06T11:00:00Z"));
  if (!("appointment" in first)) throw new Error("missing appointment");
  await slowFeed();
  const before = await snapshot();
  await expect(maiaAppointment(request("reschedule", { appointment_id: first.appointment.id, start_at: "2026-11-05T11:00:00Z" }))).rejects.toThrow("invalid_slot");
  expect(await snapshot()).toBe(before);
});

it("owner approval rechecks the production clock after refresh and retains pending state", async () => {
  const pending = await maiaAppointment(booking("2026-11-05T11:00:00Z", "in_person"));
  if (!("appointment" in pending)) throw new Error("missing appointment");
  await slowFeed();
  const before = await snapshot();
  await expect(ownerAppointment({ id: pending.appointment.id, version: 1, operation: "approve", travel_before: 0, travel_after: 0 })).rejects.toThrow("invalid_slot");
  expect(await snapshot()).toBe(before);
});

it("availability rechecks its injected live clock after awaited conflict queries", async () => {
  // Successive clock samples cross the boundary while the async scan is running.
  let instant = base.getTime() - 1;
  const clock = () => new Date(instant++);
  const result = await maiaAppointment(request("availability"), clock);
  expect(result).toHaveProperty("slots");
  if (!("slots" in result) || !result.slots) throw new Error("missing slots");
  expect(result.slots.length).toBeGreaterThan(0);
  for (const slot of result.slots) expect(new Date(slot.start_at).getTime() - instant).toBeGreaterThanOrEqual(7200000);
});
