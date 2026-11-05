import {readFileSync,readdirSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {beforeAll,beforeEach,expect,it,vi} from "vitest";
import {sql} from "drizzle-orm";
import {getDb} from "@/db";
import {appointments,appointmentRequests,appointmentHistory,events,calendars} from "@/db/schema";
import {maiaAppointment,ownerAppointment} from "@/server/appointments";
import {withCalendarTransaction} from "@/server/calendar-lock";
import {syncCalendar} from "@/server/calendar";
import {saveManualEvent} from "@/server/calendar-writes";
import {updateCalendar,deleteCalendar,addIcsCalendar} from "@/app/actions/calendar";
vi.mock("@/lib/auth",()=>({requireAuth:async()=>{}}));
vi.mock("next/cache",()=>({revalidatePath:()=>{}}));
const now=new Date("2026-11-05T09:00:00Z");
const input=(id=randomUUID())=>({version:1,operation:"book",contact_id:"11111111-1111-4111-8111-111111111111",args:{start_at:"2026-11-05T11:00:00Z",mode:"remote",subject:"Fixture"},request_id:id});
it.each(["availability", "book", "reschedule", "approve"])("%s samples live time after a proven PostgreSQL lock wait", async operation => {
 const db = await getDb();
 vi.useFakeTimers({toFake:["Date"]}); vi.setSystemTime(now);
 let id = "";
 if (operation === "reschedule" || operation === "approve") {
  const seed = input();
  const result = await maiaAppointment({...seed,args:{...seed.args,start_at:operation === "approve" ? seed.args.start_at : "2026-11-06T11:00:00Z",mode:operation === "approve" ? "in_person":"remote",address:"SYNTHETIC"}});
  if (!("appointment" in result)) throw new Error("missing appointment");
  id = result.appointment.id;
 }
 const snapshot = async () => JSON.stringify({appointments:await db.select().from(appointments),events:await db.select().from(events),history:await db.select().from(appointmentHistory),requests:await db.select().from(appointmentRequests)});
 const before = await snapshot();
 let acquired!:()=>void, release!:()=>void;
 const acquiredP = new Promise<void>(r=>{acquired=r;}); const releaseP = new Promise<void>(r=>{release=r;});
 const held = withCalendarTransaction(async()=>{acquired();await releaseP;}); await acquiredP;
 const seed = input();
 const work = operation === "approve" ? ownerAppointment({id,version:1,operation:"approve",travel_before:0,travel_after:0}) : maiaAppointment(operation === "book" ? seed : {...seed,operation,args:operation === "reschedule" ? {appointment_id:id,start_at:seed.args.start_at}: {}});
 const outcome = work.then(value=>({value,error:""}),error=>({value:null,error:error.message}));
 try {
  let waiting = false;
  for (let i=0;i<100;i++) {
   const rows = await db.select({n:sql<number>`count(*)::int`}).from(sql`pg_stat_activity`).where(sql`datname=current_database() AND wait_event_type='Lock' AND query LIKE '%calendar_write_lock%'`);
   if (Number(rows[0]?.n)>0) {waiting=true;break;}
   await new Promise(r=>setTimeout(r,10));
  }
  expect(waiting).toBe(true);
  vi.setSystemTime(new Date(now.getTime()+19000)); release(); await held;
  const result = await outcome;
  if (operation === "availability") expect(result.value).toMatchObject({slots:[{start_at:"2026-11-05T12:00:00.000Z"},{start_at:"2026-11-05T13:00:00.000Z"}]});
  else expect(result.error).toBe("invalid_slot");
  expect(await snapshot()).toBe(before);
 } finally {release();await held;await outcome;vi.useRealTimers();}
});
beforeAll(async()=>{
 const db=await getDb();
 for(const name of readdirSync("drizzle").filter(n=>n.endsWith(".sql")).sort()) for(const statement of readFileSync(`drizzle/${name}`,"utf8").split("--> statement-breakpoint")) if(statement.trim()) await db.execute(sql.raw(statement));
});
beforeEach(async()=>{
 const db=await getDb();await db.delete(appointmentHistory);await db.delete(appointmentRequests);await db.delete(appointments);await db.delete(events);await db.delete(calendars);
});
it("serializes two competing real PostgreSQL connections",async()=>{
 const results=await Promise.allSettled([maiaAppointment(input(),now),maiaAppointment(input(),now)]);
 expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
 expect(results.filter(r=>r.status==="rejected")).toHaveLength(1);
 expect(await (await getDb()).select().from(events)).toHaveLength(1);
});
it("deduplicates concurrent delivery and rolls back all effects on history failure",async()=>{
 const v=input(); const results=await Promise.all([maiaAppointment(v,now),maiaAppointment(v,now)]);
 expect(results.map(r=>(r as {repeated:boolean}).repeated).sort()).toEqual([false,true]);
 const db=await getDb();expect(await db.select().from(events)).toHaveLength(1);
 await db.execute(sql`ALTER TABLE appointment_history ADD CONSTRAINT fixture_fail CHECK (operation <> 'book') NOT VALID`);
 try {
  await expect(maiaAppointment({...input(),args:{...v.args,start_at:"2026-11-05T12:00:00Z"}},now)).rejects.toThrow();
  expect(await db.select().from(events)).toHaveLength(1);expect(await db.select().from(appointments)).toHaveLength(1);expect(await db.select().from(appointmentRequests)).toHaveLength(1);
 }finally{await db.execute(sql`ALTER TABLE appointment_history DROP CONSTRAINT fixture_fail`);}
});
it("never observes a half-synced ICS snapshot while booking",async()=>{
 vi.setSystemTime(now);
 const db=await getDb();const [cal]=await db.insert(calendars).values({name:"Private",kind:"ics",url:"https://fixture.invalid"}).returning();
 let entered!:()=>void,release!:()=>void;const enteredP=new Promise<void>(r=>{entered=r;});const releaseP=new Promise<void>(r=>{release=r;});
 vi.stubGlobal("fetch",vi.fn(async()=>{entered();await releaseP;return new Response("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:busy\r\nDTSTART:20261105T110000Z\r\nDTEND:20261105T120000Z\r\nSUMMARY:Secret\r\nEND:VEVENT\r\nEND:VCALENDAR");}));
 const sync=syncCalendar(cal.id);await enteredP;
 const booking=maiaAppointment(input(),now);const outcome=booking.then(()=>"confirmed",e=>e.message);
 try{release();expect(await sync).toBe(1);expect(await outcome).toBe("slot_unavailable");expect(await db.select().from(appointments)).toHaveLength(0);}finally{vi.unstubAllGlobals();vi.useRealTimers();}
});
it("serializes legacy manual-event writers against the reserved gap",async()=>{
 const results=await Promise.allSettled([maiaAppointment(input(),now),saveManualEvent(null,{title:"Gap",startAt:new Date("2026-11-05T11:50:00Z"),endAt:new Date("2026-11-05T12:00:00Z")})]);
 expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
 expect(await (await getDb()).select().from(events)).toHaveLength(1);
});
it("coordinates calendar configuration writers with the booking transaction lock",async()=>{
 const db=await getDb(); const [cal]=await db.insert(calendars).values({name:"Fixture"}).returning();
 for(const writer of [()=>updateCalendar(cal.id,{enabled:false}),()=>deleteCalendar(cal.id),()=>addIcsCalendar({name:"Fixture ICS",url:"https://fixture.invalid"})]) {
  let acquired!:()=>void,release!:()=>void;
  const acquiredP=new Promise<void>(r=>{acquired=r;});const releaseP=new Promise<void>(r=>{release=r;});
  const held=withCalendarTransaction(async()=>{acquired();await releaseP;});await acquiredP;
  let settled=false;
  vi.stubGlobal("fetch",vi.fn(async()=>new Response("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR")));
  const write=writer().finally(()=>{settled=true;});
  try {await new Promise(r=>setTimeout(r,150));expect(settled).toBe(false);}finally{release();await held;await write;vi.unstubAllGlobals();}
 }
});
