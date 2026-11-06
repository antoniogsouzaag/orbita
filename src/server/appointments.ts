import "server-only";
import { createHash } from "node:crypto";
import { and, asc, desc, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { appointments, appointmentHistory, appointmentRequests, calendars, events } from "@/db/schema";
import { syncCalendarInTransaction } from "./calendar";
import { withCalendarTransaction, type CalendarTx } from "./calendar-lock";

const common = {version: z.literal(1), contact_id: z.uuid()};
const availability = z.object({ from_date: z.iso.date().optional(), period: z.enum(["morning", "afternoon"]).optional() }).strict();
const book = z.object({ start_at: z.iso.datetime({ offset: true }), mode: z.enum(["remote", "in_person"]), subject: z.string().trim().min(1).max(500), remote_preference: z.string().trim().min(1).max(120).optional(), address: z.string().trim().min(1).max(500).optional(), customer_name: z.string().trim().min(1).max(120).optional() }).strict().refine(v => v.mode !== "in_person" || !!v.address);
export const maiaInput = z.discriminatedUnion("operation", [
  z.object({...common, operation: z.literal("availability"), args: availability, request_id: z.uuid().optional()}).strict(),
  z.object({...common, operation: z.literal("list"), args: z.object({}).strict(), request_id: z.uuid().optional()}).strict(),
  z.object({...common, operation: z.literal("book"), args: book, request_id: z.uuid()}).strict(),
  z.object({...common, operation: z.literal("cancel"), args: z.object({appointment_id:z.uuid()}).strict(), request_id: z.uuid()}).strict(),
  z.object({...common, operation: z.literal("reschedule"), args: z.object({appointment_id:z.uuid(),start_at:z.iso.datetime({offset:true})}).strict(), request_id: z.uuid()}).strict(),
]);
export class AppointmentError extends Error {
  constructor(public code: string, public status = 409) { super(code); }
}
type Appointment = typeof appointments.$inferSelect;
export function projectAppointment(a: Appointment) {
  return { id: a.id, state: a.state, mode: a.mode, start_at: a.startAt.toISOString(), end_at: a.endAt.toISOString(), subject: a.subject, remote_preference: a.remotePreference, address: a.address };
}
const HOUR = 3600000;
function legal(t: number, now: Date) {
  const d = new Date(t - 3 * HOUR);
  return Number.isFinite(t) && t >= now.getTime() + 2 * HOUR && t <= now.getTime() + 14 * 86400000 && ![0,6].includes(d.getUTCDay()) && [8,9,10,13,14,15,16,17].includes(d.getUTCHours()) && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}
export async function refreshAppointmentCalendars(tx: CalendarTx) {
  const enabled = await tx.select().from(calendars).where(and(eq(calendars.kind,"ics"),eq(calendars.enabled,true)));
  for (const cal of enabled) {
    if (cal.lastError || !cal.lastSyncedAt || Date.now()-cal.lastSyncedAt.getTime() >= 30*60000) {
      try { await syncCalendarInTransaction(tx,cal.id); } catch { throw new AppointmentError("calendar_unavailable",503); }
    }
  }
}
async function free(tx: CalendarTx, start: Date, end: Date, ignore?: Appointment) {
  const rows = await tx.select({e:events}).from(events).leftJoin(calendars, eq(events.calendarId, calendars.id)).where(and(lt(events.startAt,end),gte(events.endAt,new Date(start.getTime()-86400000)),or(isNull(events.calendarId),eq(calendars.enabled,true))));
  for (const {e} of rows) {
    if (e.id === ignore?.eventId) continue;
    // Date-only ICS uses exclusive midnight UTC storage; interpret dates in Brasília.
    const shift = e.allDay ? 3*HOUR : 0;
    if (e.startAt.getTime()+shift < end.getTime() && e.endAt.getTime()+shift > start.getTime()) return false;
  }
  const reserved = await tx.select().from(appointments).where(eq(appointments.state,"confirmed"));
  return !reserved.some(a => a.id !== ignore?.id && a.startAt.getTime()-a.travelBefore*60000 < end.getTime() && a.startAt.getTime()+HOUR+a.travelAfter*60000 > start.getTime());
}
async function record(tx:CalendarTx, a:Appointment, operation:string, actor="maia") {
  await tx.insert(appointmentHistory).values({appointmentId:a.id,version:a.version,actor,operation,snapshot:JSON.parse(JSON.stringify(a))});
}
export async function ownerAppointments(id?:string) {
  if(id) z.uuid().parse(id);
  const db=await getDb();
  const rows=await db.select().from(appointments).where(id ? eq(appointments.id,id) : undefined).orderBy(sql`CASE WHEN ${appointments.state} = 'pending_approval' THEN 0 WHEN ${appointments.state} = 'confirmed' THEN 1 ELSE 2 END`,desc(appointments.createdAt)).limit(100);
  return Promise.all(rows.map(async a=>({...a,history:await db.select().from(appointmentHistory).where(eq(appointmentHistory.appointmentId,a.id)).orderBy(desc(appointmentHistory.version))})));
}

const ownerCommon = {id:z.uuid(),version:z.number().int().positive()};
export const ownerInput = z.discriminatedUnion("operation",[
  z.object({...ownerCommon,operation:z.literal("approve"),travel_before:z.number().int().min(0).max(600),travel_after:z.number().int().min(0).max(600)}).strict(),
  z.object({...ownerCommon,operation:z.enum(["reject","cancel"])}).strict(),
]);
export async function ownerAppointment(input:unknown, clock: Clock = () => new Date()) {
  const v=ownerInput.parse(input);
  return withCalendarTransaction(async tx=>{
    const [a]=await tx.select().from(appointments).where(eq(appointments.id,v.id));
    if(!a) throw new AppointmentError("not_found",404);
    if(a.version!==v.version) throw new AppointmentError("version_conflict");
    if (!["confirmed","pending_approval"].includes(a.state)) throw new AppointmentError("invalid_state");
    let eventId=a.eventId;
    let state:Appointment["state"];
    let travelBefore=a.travelBefore,travelAfter=a.travelAfter;
    if(v.operation==="approve") {
      if(a.mode!=="in_person" || a.state!=="pending_approval") throw new AppointmentError("invalid_state");
      const t=a.startAt.getTime();
      if(!legal(t,readClock(clock))) throw new AppointmentError("invalid_slot",422);
      const from=t-v.travel_before*60000, to=t+HOUR+v.travel_after*60000;
      const day=new Date(t-3*HOUR).toISOString().slice(0,10);
      const morning=new Date(`${day}T08:00:00-03:00`).getTime();
      const lunch=new Date(`${day}T11:00:00-03:00`).getTime();
      const afternoon=new Date(`${day}T13:00:00-03:00`).getTime();
      const close=new Date(`${day}T18:00:00-03:00`).getTime();
      if(from<morning || to>close || (from<afternoon && to>lunch)) throw new AppointmentError("invalid_buffers",422);
      await refreshAppointmentCalendars(tx);
      if(!await free(tx,new Date(from),new Date(to),a)) throw new AppointmentError("slot_unavailable");
      if(!legal(t,readClock(clock))) throw new AppointmentError("invalid_slot",422);
      const [event]=await tx.insert(events).values({title:a.subject,location:a.address,startAt:a.startAt,endAt:a.endAt}).returning();
      eventId=event.id; state="confirmed"; travelBefore=v.travel_before; travelAfter=v.travel_after;
    } else {
      if(v.operation==="reject" && a.state!=="pending_approval") throw new AppointmentError("invalid_state");
      state=v.operation==="reject"?"rejected":"cancelled"; eventId=null;
    }
    if(v.operation==="approve" && !legal(a.startAt.getTime(),readClock(clock))) throw new AppointmentError("invalid_slot",422);
    const [updated]=await tx.update(appointments).set({state,eventId,travelBefore,travelAfter,version:a.version+1}).where(and(eq(appointments.id,a.id),eq(appointments.version,v.version))).returning();
    if(!updated) throw new AppointmentError("version_conflict");
    if(a.eventId && eventId===null) await tx.delete(events).where(eq(events.id,a.eventId));
    await record(tx,updated,v.operation,"owner");
    return updated;
  });
}

// Date is retained for legacy fixed-time fixtures; production always reads a live clock.
type Clock = Date | (() => Date);
function readClock(clock: Clock) { return typeof clock === "function" ? clock() : clock; }
export async function maiaAppointment(input: unknown, clock: Clock = () => new Date()) {
  const v = maiaInput.parse(input);
  return withCalendarTransaction(async tx => {
    if (v.operation === "list") {
      const now = readClock(clock);
      const rows = await tx.select().from(appointments).where(and(eq(appointments.contactId,v.contact_id),gte(appointments.startAt,new Date(now.getTime()-14*86400000)))).orderBy(asc(appointments.startAt)).limit(20);
      return {version:1,ok:true,operation:"list",appointments:rows.map(projectAppointment)};
    }
    if (v.operation === "availability") {
      await refreshAppointmentCalendars(tx);
      const now = readClock(clock);
      const slots: { start_at: string; end_at: string }[] = [];
      for (let t = Math.ceil((now.getTime() + 2 * HOUR) / HOUR) * HOUR; t <= now.getTime() + 14 * 86400000 && slots.length < 2; t += HOUR) {
        const d = new Date(t - 3 * HOUR); const h = d.getUTCHours();
        if (!legal(t, now) || (v.args.from_date && d.toISOString().slice(0,10) < v.args.from_date) || (v.args.period === "morning" && h > 10) || (v.args.period === "afternoon" && h < 13)) continue;
        if (!await free(tx, new Date(t), new Date(t + HOUR))) continue;
        if (!legal(t, readClock(clock))) continue;
        slots.push({ start_at: new Date(t).toISOString(), end_at: new Date(t + 45 * 60000).toISOString() });
      }
      // Later conflict queries may also expire a slot collected earlier in this scan.
      const decidedAt = readClock(clock);
      return { version: 1, ok: true, operation: "availability", timezone: "America/Sao_Paulo", slots: slots.filter(slot => legal(new Date(slot.start_at).getTime(), decidedAt)) };
    }
    const digest = createHash("sha256").update(JSON.stringify(v)).digest("hex");
    const [prior] = await tx.select().from(appointmentRequests).where(eq(appointmentRequests.id, v.request_id));
    if (prior) {
      if (prior.digest !== digest) throw new AppointmentError("request_conflict");
      return {...prior.receipt, repeated:true};
    }
    let appointment: Appointment;
    if (v.operation === "book") {
      await refreshAppointmentCalendars(tx);
      const t = new Date(v.args.start_at).getTime();
      if (!legal(t, readClock(clock))) throw new AppointmentError("invalid_slot", 422);
      if (!await free(tx, new Date(t), new Date(t + HOUR))) throw new AppointmentError("slot_unavailable");
      if (!legal(t, readClock(clock))) throw new AppointmentError("invalid_slot", 422);
      const [event] = await tx.insert(events).values({ title: v.args.subject, location:v.args.mode === "in_person" ? v.args.address : null, startAt:new Date(t), endAt:new Date(t+45*60000) }).returning();
      if (!legal(t, readClock(clock))) throw new AppointmentError("invalid_slot", 422);
      [appointment] = await tx.insert(appointments).values({ contactId:v.contact_id, customerName:v.args.customer_name, mode:v.args.mode, subject:v.args.subject, remotePreference:v.args.remote_preference, address:v.args.address, state:"confirmed", startAt:new Date(t), endAt:new Date(t+45*60000), eventId:event.id }).returning();
    } else {
      const [old] = await tx.select().from(appointments).where(and(eq(appointments.id,v.args.appointment_id),eq(appointments.contactId,v.contact_id)));
      if (!old) throw new AppointmentError("not_found",404);
      if (!["confirmed","pending_approval"].includes(old.state)) throw new AppointmentError("invalid_state");
      if (v.operation === "cancel") {
        [appointment] = await tx.update(appointments).set({state:"cancelled",eventId:null,version:old.version+1}).where(eq(appointments.id,old.id)).returning();
        if (old.eventId) await tx.delete(events).where(eq(events.id,old.eventId));
      } else {
        await refreshAppointmentCalendars(tx);
        const t = new Date(v.args.start_at).getTime();
        if (!legal(t,readClock(clock))) throw new AppointmentError("invalid_slot",422);
        if (!await free(tx,new Date(t),new Date(t+HOUR),old)) throw new AppointmentError("slot_unavailable");
        if (!legal(t,readClock(clock))) throw new AppointmentError("invalid_slot",422);
        if (old.eventId) await tx.update(events).set({startAt:new Date(t),endAt:new Date(t+45*60000)}).where(eq(events.id,old.eventId));
        if (!legal(t,readClock(clock))) throw new AppointmentError("invalid_slot",422);
        [appointment] = await tx.update(appointments).set({startAt:new Date(t),endAt:new Date(t+45*60000),state:old.state,eventId:old.eventId,travelBefore:0,travelAfter:0,version:old.version+1}).where(eq(appointments.id,old.id)).returning();
      }
    }
    await record(tx,appointment,v.operation);
    const receipt = {version:1,ok:true,operation:v.operation,appointment:projectAppointment(appointment),repeated:false};
    await tx.insert(appointmentRequests).values({id:v.request_id,digest,receipt});
    return receipt;
  });
}
