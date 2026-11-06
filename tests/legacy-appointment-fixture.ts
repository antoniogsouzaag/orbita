import {maiaInput,projectAppointment} from "@/server/appointments";
import {getDb} from "@/db";
import {appointments,appointmentHistory} from "@/db/schema";
// Historical state is seeded explicitly, never manufactured by the new booking path.
export async function legacyPending(raw:unknown, clock?:unknown) {
 void clock;
 const input=maiaInput.parse(raw);if(input.operation!=="book") throw new Error("fixture requires book input");
 const db=await getDb();const startAt=new Date(input.args.start_at);
 const [a]=await db.insert(appointments).values({contactId:input.contact_id,mode:"in_person",state:"pending_approval",subject:input.args.subject,address:input.args.address,customerName:input.args.customer_name,startAt,endAt:new Date(startAt.getTime()+45*60000)}).returning();
 await db.insert(appointmentHistory).values({appointmentId:a.id,version:1,actor:"maia",operation:"book",snapshot:JSON.parse(JSON.stringify(a))});
 return {appointment:projectAppointment(a)};
}
