import { tokenMatches } from "@/lib/auth";
import { ZodError } from "zod";
import { AppointmentError, maiaAppointment } from "@/server/appointments";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const fail=(error:string,status:number)=>Response.json({version:1,ok:false,error},{status,headers:{"cache-control":"no-store"}});
export async function POST(request:Request) {
  const token=process.env.MAIA_APPOINTMENTS_TOKEN;
  if(process.env.MAIA_APPOINTMENTS_ENABLED!=="true" || !token || token.length<32) return fail("unavailable",503);
  const provided=request.headers.get("authorization");
  if(!provided?.startsWith("Bearer ") || !tokenMatches(provided.slice(7),"MAIA_APPOINTMENTS_TOKEN")) return fail("unauthorized",401);
  if(!request.headers.get("content-type")?.startsWith("application/json")) return fail("invalid_request",400);
  try {
    const text=await request.text();
    if(text.length>8192) return fail("invalid_request",400);
    return Response.json(await maiaAppointment(JSON.parse(text)),{headers:{"cache-control":"no-store"}});
  } catch(e) {
    if(e instanceof AppointmentError) return fail(e.code,e.status);
    return fail(e instanceof ZodError || e instanceof SyntaxError ? "invalid_request":"unavailable",e instanceof ZodError || e instanceof SyntaxError ?400:503);
  }
}
