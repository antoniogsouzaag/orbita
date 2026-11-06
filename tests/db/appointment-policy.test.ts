import {legacyPending} from "../legacy-appointment-fixture";
import {createServer} from "node:http";
import {AddressInfo} from "node:net";
import {beforeEach,afterEach,expect,it,vi} from "vitest";
import {getDb} from "@/db";
import {appointments,appointmentHistory,appointmentRequests,calendars,events} from "@/db/schema";
import {maiaAppointment,ownerAppointment,ownerAppointments} from "@/server/appointments";
const now=new Date("2026-11-05T09:00:00Z");
const contact_id="11111111-1111-4111-8111-111111111111";
const req=(operation:string,args:unknown={},request_id="22222222-2222-4222-8222-222222222222")=>({version:1,operation,contact_id,args,request_id});
const book=(start_at:string,extra={})=>req("book",{start_at,mode:"remote",subject:"Fixture",...extra});
beforeEach(async()=>{const db=await getDb();await db.delete(appointmentHistory);await db.delete(appointmentRequests);await db.delete(appointments);await db.delete(events);await db.delete(calendars);});
afterEach(()=>vi.unstubAllGlobals());
it.each(["2026-11-05T10:00:00Z","2026-11-05T11:30:00Z","2026-11-05T14:00:00Z","2026-11-05T15:00:00Z","2026-11-05T21:00:00Z","2026-11-07T11:00:00Z","2026-11-20T11:00:00Z"])("denies illegal start %s",async start=>{await expect(maiaAppointment(book(start),now)).rejects.toThrow("invalid_slot");expect(await (await getDb()).select().from(events)).toHaveLength(0);});
it("denies digest conflicts and unknown transport fields",async()=>{
 await maiaAppointment(book("2026-11-05T11:00:00Z"),now);
 await expect(maiaAppointment(book("2026-11-05T12:00:00Z"),now)).rejects.toThrow("request_conflict");
 for(const input of [{...req("availability"),extra:1},req("availability",{limit:100}),req("book",{start_at:"2026-11-05T11:00:00Z",subject:"X",mode:"in_person"}),req("list",{contact_id})]) await expect(maiaAppointment(input,now)).rejects.toThrow();
});
it("fails closed on stale feed errors for offer, booking and owner approval without changing state",async()=>{
 const pending=await legacyPending(book("2026-11-05T12:00:00Z",{mode:"in_person",address:"Fixture"}),now) as {appointment:{id:string}};
 const db=await getDb();await db.insert(calendars).values({name:"Private feed",kind:"ics",url:"https://fixture.invalid",lastSyncedAt:new Date(0)});
 vi.stubGlobal("fetch",vi.fn(async()=>new Response("Private error",{status:503})));
 await expect(maiaAppointment(req("availability"),now)).rejects.toThrow("calendar_unavailable");
 await expect(maiaAppointment({...book("2026-11-05T11:00:00Z"),request_id:"33333333-3333-4333-8333-333333333333"},now)).rejects.toThrow("calendar_unavailable");
 await expect(ownerAppointment({id:pending.appointment.id,version:1,operation:"approve",travel_before:0,travel_after:0},now)).rejects.toThrow("calendar_unavailable");
 expect(await db.select().from(events)).toHaveLength(0);expect((await db.select().from(appointments))[0]).toMatchObject({state:"pending_approval",version:1});
});
it("uses enabled calendar visibility, Brasília all-day dates and exclusive end boundary",async()=>{
 const db=await getDb();const [disabled]=await db.insert(calendars).values({name:"Hidden",enabled:false}).returning();
 await db.insert(events).values([
 {title:"Whole Thursday",allDay:true,startAt:new Date("2026-11-05T00:00:00Z"),endAt:new Date("2026-11-06T00:00:00Z")},
 {title:"Hidden Friday",calendarId:disabled.id,startAt:new Date("2026-11-06T11:00:00Z"),endAt:new Date("2026-11-06T12:00:00Z")},
 ]);
 expect(await maiaAppointment(req("availability"),now)).toMatchObject({slots:[{start_at:"2026-11-06T11:00:00.000Z"},{start_at:"2026-11-06T12:00:00.000Z"}]});
});
it("preserves existing owner-configured ICS redirect compatibility",async()=>{
 const server=createServer((request,response)=>{
  if(request.url==="/redirect") {response.writeHead(302,{location:"/calendar.ics"});response.end();}
  else {response.writeHead(200,{"content-type":"text/calendar"});response.end("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR");}
 });
 await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));
 try {
  await (await getDb()).insert(calendars).values({name:"Fixture redirect",kind:"ics",url:`http://127.0.0.1:${(server.address() as AddressInfo).port}/redirect`});
  expect(await maiaAppointment(req("availability"),now)).toMatchObject({ok:true,slots:[{start_at:"2026-11-05T11:00:00.000Z"},{start_at:"2026-11-05T12:00:00.000Z"}]});
 }finally{server.closeAllConnections();await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
});
it("preserves presencial identity and preferences through reschedule and cancel",async()=>{
 const first=await maiaAppointment(book("2026-11-05T12:00:00Z",{mode:"in_person",address:"Fixture",remote_preference:"Preferência mantida"}),now) as {appointment:Record<string,unknown>&{id:string}};
 const rescheduled=await maiaAppointment(req("reschedule",{appointment_id:first.appointment.id,start_at:"2026-11-05T13:00:00Z"},"33333333-3333-4333-8333-333333333333"),now) as {appointment:Record<string,unknown>};
 expect(rescheduled.appointment).toEqual({...first.appointment,start_at:"2026-11-05T13:00:00.000Z",end_at:"2026-11-05T13:45:00.000Z",state:"confirmed"});
 const cancelled=await maiaAppointment(req("cancel",{appointment_id:first.appointment.id},"44444444-4444-4444-8444-444444444444"),now) as {appointment:Record<string,unknown>};
 expect(cancelled.appointment).toEqual({...rescheduled.appointment,state:"cancelled"});
 expect((await (await getDb()).select().from(appointments))[0]).toMatchObject({contactId:contact_id,mode:"in_person",subject:"Fixture",address:"Fixture",remotePreference:"Preferência mantida"});
 await expect(maiaAppointment(req("reschedule",{appointment_id:first.appointment.id,start_at:"2026-11-05T16:00:00Z",mode:"remote"},"55555555-5555-4555-8555-555555555555"),now)).rejects.toThrow();
});
it("prioritizes pending owner action ahead of cancelled history",async()=>{
 const db=await getDb();await db.insert(appointments).values(Array.from({length:100},()=>({contactId:contact_id,state:"cancelled" as const,mode:"remote" as const,subject:"Old",startAt:now,endAt:now})));
 await legacyPending(book("2026-11-05T12:00:00Z",{mode:"in_person",address:"Fixture"}),now);
 expect((await ownerAppointments())[0]).toMatchObject({state:"pending_approval"});
});
it("bounds scoped list to twenty projections with no contact/event/history data",async()=>{
 const db=await getDb();await db.insert(appointments).values(Array.from({length:22},(_,i)=>({contactId:contact_id,state:"pending_approval" as const,mode:"in_person" as const,subject:`Own ${i}`,address:"Fixture",startAt:new Date(now.getTime()+i*3600000),endAt:new Date(now.getTime()+i*3600000+2700000)})));
 await db.insert(appointments).values({contactId:"33333333-3333-4333-8333-333333333333",state:"confirmed",mode:"remote",subject:"Secret",startAt:now,endAt:now});
 const result=await maiaAppointment(req("list"),now) as {appointments:unknown[]};expect(result.appointments).toHaveLength(20);
 expect(Object.keys(result.appointments[0] as object).sort()).toEqual(["id","state","mode","start_at","end_at","subject","remote_preference","address"].sort());expect(JSON.stringify(result)).not.toContain("Secret");
});
