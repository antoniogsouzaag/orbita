import { sql } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { calendars, events, appointments, appointmentHistory, appointmentRequests } from "@/db/schema";
import { syncCalendar } from "@/server/calendar";
import * as bookingService from "@/server/appointments";
import { maiaAppointment } from "@/server/appointments";

import { loadNotifications } from "@/server/notifications";
import { criarEvento } from "@/server/assistant";
import { saveEvent, deleteEvent } from "@/app/actions/calendar";
vi.mock("@/lib/auth",()=>({requireAuth:vi.fn(async()=>{})}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
const contact = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-11-05T09:00:00Z");
const request = (operation: string, args = {}, request_id?: string) => ({ version: 1, operation, contact_id: contact, args, ...(request_id ? { request_id } : {}) });
beforeEach(async () => {
  const db = await getDb();
  await db.delete(appointmentHistory); await db.delete(appointmentRequests); await db.delete(appointments);
  await db.delete(events); await db.delete(calendars);
});
it("availability refreshes subscribed calendars and returns only two private legal slots", async () => {
  const db = await getDb();
  await db.insert(calendars).values({ name: "Private calendar", kind: "ics", url: "https://calendar.invalid/test.ics" });
  vi.stubGlobal("fetch", vi.fn(async () => new Response("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR")));
  const result = await maiaAppointment(request("availability"), now);
  expect(result).toEqual({ version: 1, ok: true, operation: "availability", timezone: "America/Sao_Paulo", slots: [
    { start_at: "2026-11-05T11:00:00.000Z", end_at: "2026-11-05T11:45:00.000Z" },
    { start_at: "2026-11-05T12:00:00.000Z", end_at: "2026-11-05T12:45:00.000Z" },
  ] });
  expect(fetch).toHaveBeenCalledOnce();
  expect((await db.select().from(calendars))[0].lastSyncedAt).not.toBeNull();
  vi.unstubAllGlobals();
});
it("fails closed for invalid recurrence data rather than erasing busy events", async () => {
 const db = await getDb();
 const [cal] = await db.insert(calendars).values({name:"Private",kind:"ics",url:"https://calendar.invalid"}).returning();
 await db.insert(events).values({calendarId:cal.id,title:"Busy",startAt:new Date("2026-11-05T11:00:00Z"),endAt:new Date("2026-11-05T12:00:00Z")});
 vi.stubGlobal("fetch", vi.fn(async () => new Response("BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:broken\r\nDTSTART:garbage\r\nEND:VEVENT\r\nEND:VCALENDAR")));
 await expect(syncCalendar(cal.id)).rejects.toThrow();
 expect(await db.select().from(events)).toHaveLength(1);
 vi.unstubAllGlobals();
});

it("rolls back the entire ICS replacement when inserting an occurrence fails", async () => {
 const db = await getDb();
 const [cal] = await db.insert(calendars).values({name:"Private",kind:"ics",url:"https://calendar.invalid"}).returning();
 await db.insert(events).values({calendarId:cal.id,title:"Original",startAt:now,endAt:new Date(now.getTime()+3600000)});
 await db.execute(sql`ALTER TABLE events ADD CONSTRAINT fixture_title CHECK (title <> 'Forbidden')`);
 const day = new Date().toISOString().slice(0,10).replace(/-/g, "");
 vi.stubGlobal("fetch", vi.fn(async () => new Response(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:bad\r\nDTSTART:${day}T120000Z\r\nDTEND:${day}T130000Z\r\nSUMMARY:Forbidden\r\nEND:VEVENT\r\nEND:VCALENDAR`)));
 try {
  await expect(syncCalendar(cal.id)).rejects.toThrow();
  expect((await db.select().from(events)).map(e=>e.title)).toEqual(["Original"]);
 } finally { await db.execute(sql`ALTER TABLE events DROP CONSTRAINT fixture_title`); vi.unstubAllGlobals(); }
});

it("keeps a scoped appointment through failed reschedule, successful reschedule and cancellation", async () => {
 const id = "22222222-2222-4222-8222-222222222222";
 const first = await maiaAppointment(request("book",{start_at:"2026-11-05T11:00:00Z",mode:"remote",subject:"Consulta"},id),now);
 const a = (first as {appointment:{id:string}}).appointment;
 const own = await maiaAppointment(request("list"),now);
 expect(own).toMatchObject({appointments:[{id:a.id}]});
 expect(await maiaAppointment({...request("list"),contact_id:"33333333-3333-4333-8333-333333333333"},now)).toMatchObject({appointments:[]});
 await (await getDb()).insert(events).values({title:"Private",startAt:new Date("2026-11-05T12:00:00Z"),endAt:new Date("2026-11-05T13:00:00Z")});
 await expect(maiaAppointment(request("reschedule",{appointment_id:a.id,start_at:"2026-11-05T12:00:00Z"},"44444444-4444-4444-8444-444444444444"),now)).rejects.toThrow("slot_unavailable");
 expect(await maiaAppointment(request("list"),now)).toMatchObject({appointments:[{start_at:"2026-11-05T11:00:00.000Z"}]});
 expect(await maiaAppointment(request("reschedule",{appointment_id:a.id,start_at:"2026-11-05T13:00:00Z"},"55555555-5555-4555-8555-555555555555"),now)).toMatchObject({appointment:{start_at:"2026-11-05T13:00:00.000Z",state:"confirmed"}});
 await expect(maiaAppointment({...request("cancel",{appointment_id:a.id},"66666666-6666-4666-8666-666666666666"),contact_id:"33333333-3333-4333-8333-333333333333"},now)).rejects.toThrow("not_found");
 expect(await maiaAppointment(request("cancel",{appointment_id:a.id},"77777777-7777-4777-8777-777777777777"),now)).toMatchObject({appointment:{state:"cancelled"}});
 expect(await maiaAppointment(request("book",{start_at:"2026-11-05T11:00:00Z",mode:"remote",subject:"Consulta"},id),now)).toEqual({...first,repeated:true});
 expect(await (await getDb()).select().from(appointmentHistory)).toHaveLength(3);
});

it("requires explicit owner travel review with CAS before confirming presencial", async () => {
 const first = await maiaAppointment(request("book",{start_at:"2026-11-05T12:00:00Z",mode:"in_person",subject:"Presencial",address:"Endereço de teste"},"22222222-2222-4222-8222-222222222222"),now);
 const a = (first as {appointment:{id:string}}).appointment;
 expect(first).toMatchObject({appointment:{state:"pending_approval"}});
 expect(await (await getDb()).select().from(events)).toHaveLength(0);
 expect(bookingService.ownerAppointment).toBeTypeOf("function");
 await expect(bookingService.ownerAppointment({id:a.id,version:1,operation:"approve"},now)).rejects.toThrow();
 await expect(bookingService.ownerAppointment({id:a.id,version:1,operation:"approve",travel_before:120,travel_after:0},now)).rejects.toThrow("invalid_buffers");
 expect(await bookingService.ownerAppointment({id:a.id,version:1,operation:"approve",travel_before:30,travel_after:0},now)).toMatchObject({state:"confirmed",version:2});
 await expect(bookingService.ownerAppointment({id:a.id,version:1,operation:"reject"},now)).rejects.toThrow("version_conflict");
 expect(await maiaAppointment(request("availability"),now)).toMatchObject({slots:[{start_at:"2026-11-05T13:00:00.000Z"},{start_at:"2026-11-05T16:00:00.000Z"}]});
 expect(await bookingService.ownerAppointment({id:a.id,version:2,operation:"cancel"},now)).toMatchObject({state:"cancelled",version:3});
 expect(await (await getDb()).select().from(events)).toHaveLength(0);
});

it("blocks legacy mutations of linked events and guards manual events against the entire reserved hour", async () => {
 await maiaAppointment(request("book",{start_at:"2026-11-05T11:00:00Z",mode:"remote",subject:"Consulta"},"22222222-2222-4222-8222-222222222222"),now);
 const [event] = await (await getDb()).select().from(events);
 await expect(saveEvent(event.id,{title:"Changed",date:"2026-11-06",startTime:"08:00",endTime:"09:00"})).rejects.toThrow("agendamentos");
 await expect(deleteEvent(event.id)).rejects.toThrow("agendamentos");
 await expect(saveEvent(null,{title:"Gap collision",date:"2026-11-05",startTime:"08:50",endTime:"09:00"})).rejects.toThrow("slot_unavailable");
 await expect(saveEvent(null,{title:"Legal",date:"2026-11-05",startTime:"09:00",endTime:"09:30"})).resolves.toBeUndefined();
 expect(await (await getDb()).select().from(events)).toHaveLength(2);
});

it("guards assistant-created events against reservations", async () => {
 await maiaAppointment(request("book",{start_at:"2026-11-05T11:00:00Z",mode:"remote",subject:"Consulta"},"22222222-2222-4222-8222-222222222222"),now);
 await expect(criarEvento.run({titulo:"Collision",data:"2026-11-05",inicio:"08:50",fim:"09:00"})).rejects.toThrow("slot_unavailable");
});

it("lists owner review data with canonical CRM identity and versioned review history", async () => {
 const first=await maiaAppointment(request("book",{start_at:"2026-11-05T12:00:00Z",mode:"in_person",subject:"Presencial",address:"Teste"},"22222222-2222-4222-8222-222222222222"),now);
 expect(bookingService.ownerAppointments).toBeTypeOf("function");
 expect(await bookingService.ownerAppointments()).toMatchObject([{id:(first as {appointment:{id:string}}).appointment.id,contactId:contact,version:1,state:"pending_approval",history:[{version:1,actor:"maia",operation:"book"}]}]);
});

it("shows one stable internal pending-review notification and removes it after rejection", async () => {
 const first=await maiaAppointment(request("book",{start_at:"2026-11-05T12:00:00Z",mode:"in_person",subject:"Presencial",address:"Teste"},"22222222-2222-4222-8222-222222222222"),now);
 const id=(first as {appointment:{id:string}}).appointment.id;
 const notices=await loadNotifications("empresa");
 expect(notices.filter(n=>n.id===`appointment-${id}-v1`)).toMatchObject([{detail:"Presencial não confirmado — aprove com deslocamento ou rejeite",href:"/agenda/agendamentos",tone:"warning"}]);
 expect((await loadNotifications("empresa")).map(n=>n.id)).toEqual(notices.map(n=>n.id));
 await bookingService.ownerAppointment({id,version:1,operation:"reject"},now);
 expect((await loadNotifications("empresa")).filter(n=>n.id.startsWith("appointment-"))).toHaveLength(0);
});

it("books a remote meeting into the canonical agenda and replays the immutable receipt", async () => {
 const input = request("book", {start_at: "2026-11-05T11:00:00Z", mode: "remote", subject: "Consulta", remote_preference: "Meet"}, "22222222-2222-4222-8222-222222222222");
 const first = await maiaAppointment(input, now);
 expect(first).toMatchObject({ok:true, operation:"book", repeated:false, appointment:{state:"confirmed", remote_preference:"Meet"}});
 expect(await maiaAppointment(input, now)).toEqual({...first,repeated:true});
 expect(await (await getDb()).select().from(events)).toHaveLength(1);
});
