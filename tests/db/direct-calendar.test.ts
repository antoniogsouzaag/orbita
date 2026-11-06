import {randomUUID} from "node:crypto";
import {beforeEach,expect,it} from "vitest";
import {eq,sql} from "drizzle-orm";
import {getDb} from "@/db";
import {appointments,appointmentHistory,appointmentRequests,events,calendars} from "@/db/schema";
import {maiaAppointment,ownerAppointment,ownerAppointments} from "@/server/appointments";
import {eventsBetween} from "@/server/calendar";
import {loadNotifications} from "@/server/notifications";
const now=new Date("2026-11-05T09:00:00Z");
const contact_id="11111111-1111-4111-8111-111111111111";
const request=(operation:string,args={})=>({version:1,operation,contact_id,args,request_id:randomUUID()});
const book=(start_at="2026-11-05T11:00:00Z")=>request("book",{start_at,mode:"in_person",subject:"SYNTHETIC",address:"SYNTHETIC ADDRESS"});
beforeEach(async()=>{const db=await getDb();await db.delete(appointmentHistory);await db.delete(appointmentRequests);await db.delete(appointments);await db.delete(events);await db.delete(calendars);});
it("books presencial directly into the existing calendar with a correlated immutable receipt and occupied cell",async()=>{
 const input=book();const first=await maiaAppointment(input,now);
 expect(first).toMatchObject({appointment:{state:"confirmed",mode:"in_person"}});
 if(!("appointment" in first)) throw new Error("missing appointment");
 const db=await getDb();const [a]=await db.select().from(appointments);const [e]=await db.select().from(events);
 expect(a).toMatchObject({id:first.appointment.id,eventId:e.id,state:"confirmed",travelBefore:0,travelAfter:0});
 expect((await eventsBetween(a.startAt,a.endAt))[0]).toMatchObject({appointmentId:a.id,editable:false});
 expect(e).toMatchObject({title:"SYNTHETIC",location:"SYNTHETIC ADDRESS",startAt:a.startAt,endAt:a.endAt});
 expect((await db.select().from(appointmentHistory))[0]).toMatchObject({appointmentId:a.id,version:1,snapshot:{id:a.id,eventId:e.id,state:"confirmed"}});
 expect((await db.select().from(appointmentRequests))[0].receipt).toEqual(first);
 expect(await maiaAppointment(input,now)).toEqual({...first,repeated:true});
 expect(await db.select().from(events)).toHaveLength(1);
 expect(await maiaAppointment(request("availability"),now)).toMatchObject({slots:[{start_at:"2026-11-05T12:00:00.000Z"},{start_at:"2026-11-05T13:00:00.000Z"}]});
 await expect(maiaAppointment(book(),now)).rejects.toThrow("slot_unavailable");
 expect((await loadNotifications("empresa")).filter(n=>n.id.startsWith("appointment-"))).toHaveLength(0);
});
it("presencial reschedule stays calendar-confirmed, moves the linked event, releases old cell and protects new cell",async()=>{
 const first=await maiaAppointment(book(),now);if(!("appointment" in first)) throw new Error("missing appointment");
 const db=await getDb();const [a]=await db.select().from(appointments);
 const move=request("reschedule",{appointment_id:a.id,start_at:"2026-11-05T12:00:00Z"});
 const moved=await maiaAppointment(move,now);
 expect(moved).toMatchObject({appointment:{id:a.id,state:"confirmed",start_at:"2026-11-05T12:00:00.000Z"}});
 expect((await db.select().from(appointments))[0]).toMatchObject({eventId:a.eventId,travelBefore:0,travelAfter:0,version:2});
 expect(await db.select().from(events)).toMatchObject([{id:a.eventId,location:"SYNTHETIC ADDRESS",startAt:new Date("2026-11-05T12:00:00Z")}]);
 expect(await maiaAppointment(request("availability"),now)).toMatchObject({slots:[{start_at:"2026-11-05T11:00:00.000Z"},{start_at:"2026-11-05T13:00:00.000Z"}]});
 await expect(maiaAppointment(book("2026-11-05T12:00:00Z"),now)).rejects.toThrow("slot_unavailable");
 expect(await maiaAppointment(move,now)).toEqual({...moved,repeated:true});
 expect(await maiaAppointment(book(),now)).toMatchObject({appointment:{state:"confirmed"}});
 const snapshot=JSON.stringify(await db.select().from(events));
 await expect(maiaAppointment(request("reschedule",{appointment_id:a.id,start_at:"2026-11-05T11:00:00Z"}),now)).rejects.toThrow("slot_unavailable");
 expect(JSON.stringify(await db.select().from(events))).toBe(snapshot);
 expect((await db.select().from(appointmentHistory)).filter(h=>h.appointmentId===a.id)).toMatchObject([{version:1,snapshot:{eventId:a.eventId}},{version:2,snapshot:{eventId:a.eventId,state:"confirmed"}}]);
});
it("owner semantic cancellation releases only the linked id and cell with CAS, preserving correlated history",async()=>{
 const db=await getDb();await maiaAppointment(book(),now);await maiaAppointment(book("2026-11-05T12:00:00Z"),now);
 const [a,b]=await db.select().from(appointments).orderBy(appointments.startAt);
 // Targeted calendar navigation must not fall through the owner's 100-row list.
 await db.insert(appointments).values(Array.from({length:101},()=>({contactId:contact_id,mode:"in_person" as const,state:"pending_approval" as const,subject:"LEGACY",address:"SYNTHETIC",startAt:now,endAt:now})));
 expect((await ownerAppointments(a.id)).map(x=>x.id)).toEqual([a.id]);
 await expect(ownerAppointment({id:a.id,version:2,operation:"cancel"},now)).rejects.toThrow("version_conflict");
 const cancelled=await ownerAppointment({id:a.id,version:1,operation:"cancel"},now);
 expect(cancelled).toMatchObject({id:a.id,state:"cancelled",eventId:null,version:2});
 expect(await db.select().from(events)).toMatchObject([{id:b.eventId}]);
 expect((await db.select().from(appointments).where(eq(appointments.id,b.id)))[0]).toMatchObject({state:"confirmed",version:1,eventId:b.eventId});
 expect(await maiaAppointment(request("availability"),now)).toMatchObject({slots:[{start_at:"2026-11-05T11:00:00.000Z"},{start_at:"2026-11-05T13:00:00.000Z"}]});
 expect(await maiaAppointment(book(),now)).toMatchObject({appointment:{state:"confirmed"}});
 expect((await db.select().from(appointmentHistory).where(eq(appointmentHistory.appointmentId,a.id)))[1]).toMatchObject({actor:"owner",operation:"cancel",version:2,snapshot:{id:a.id,eventId:null,state:"cancelled"}});
});
it("semantic cancellation rolls back both appointment and event if history persistence fails",async()=>{
 const db=await getDb();await maiaAppointment(book(),now);const [a]=await db.select().from(appointments);
 const snapshot=async()=>JSON.stringify({appointments:await db.select().from(appointments),events:await db.select().from(events),history:await db.select().from(appointmentHistory),receipts:await db.select().from(appointmentRequests)});
 const before=await snapshot();await db.execute(sql`ALTER TABLE appointment_history ADD CONSTRAINT fixture_cancel_fail CHECK (operation <> 'cancel') NOT VALID`);
 try {await expect(ownerAppointment({id:a.id,version:1,operation:"cancel"},now)).rejects.toThrow();expect(await snapshot()).toBe(before);}
 finally {await db.execute(sql`ALTER TABLE appointment_history DROP CONSTRAINT fixture_cancel_fail`);}
});

