import { ZodError } from "zod";
import { isAuthenticated } from "@/lib/auth";
import { AppointmentError, ownerAppointment } from "@/server/appointments";
export const runtime="nodejs";
const fail=(error:string,status:number)=>Response.json({version:1,ok:false,error},{status,headers:{"cache-control":"no-store"}});
export async function POST(request:Request) {
  if(!await isAuthenticated()) return fail("unauthorized",401);
  let expectedOrigin:string;
  try {
    const canonical=new URL(process.env.APP_URL || request.url);
    if(!["http:","https:"].includes(canonical.protocol)) return fail("unavailable",503);
    expectedOrigin=canonical.origin;
  }catch{return fail("unavailable",503);}
  if(request.headers.get("origin")!==expectedOrigin || request.headers.get("sec-fetch-site")==="cross-site") return fail("forbidden",403);
  if(!request.headers.get("content-type")?.startsWith("application/json")) return fail("invalid_request",400);
  try {
    const text=await request.text();
    if(text.length>4096) return fail("invalid_request",400);
    const appointment=await ownerAppointment(JSON.parse(text));
    return Response.json({version:1,ok:true,appointment},{headers:{"cache-control":"no-store"}});
  }catch(e){
    if(e instanceof AppointmentError) return fail(e.code,e.status);
    return fail(e instanceof ZodError || e instanceof SyntaxError ?"invalid_request":"unavailable",e instanceof ZodError || e instanceof SyntaxError ?400:503);
  }
}
