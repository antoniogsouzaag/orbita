import "server-only";
import { eq } from "drizzle-orm";
import { calendars, events, appointments } from "@/db/schema";
import { withCalendarTransaction, type CalendarTx } from "./calendar-lock";
async function editable(tx:CalendarTx,id:string) {
  const [linked]=await tx.select().from(appointments).where(eq(appointments.eventId,id));
  if(linked) throw new Error("Use /agenda/agendamentos para alterar este compromisso");
  const [event]=await tx.select({id:events.id,calendarId:events.calendarId,kind:calendars.kind}).from(events).leftJoin(calendars,eq(events.calendarId,calendars.id)).where(eq(events.id,id));
  if(!event) throw new Error("Evento não encontrado");
  if(event.calendarId && event.kind!=="local") throw new Error("Este evento pertence a um calendário assinado. Edite-o na origem.");
}
export async function saveManualEvent(id:string|null,values:typeof events.$inferInsert) {
  return withCalendarTransaction(async tx=>{
    if(id) await editable(tx,id);
    const start=values.startAt.getTime()+(values.allDay?3*3600000:0), end=values.endAt.getTime()+(values.allDay?3*3600000:0);
    const reserved=await tx.select().from(appointments).where(eq(appointments.state,"confirmed"));
    if(reserved.some(a=>a.startAt.getTime()-a.travelBefore*60000<end && a.startAt.getTime()+3600000+a.travelAfter*60000>start)) throw new Error("slot_unavailable");
    if(id) await tx.update(events).set(values).where(eq(events.id,id));
    else await tx.insert(events).values(values);
  });
}
export async function deleteManualEvent(id:string) {
  return withCalendarTransaction(async tx=>{
    await editable(tx,id);
    await tx.delete(events).where(eq(events.id,id));
  });
}
