import { afterEach, expect, it, vi } from "vitest";
import * as maia from "@/app/api/appointments/maia/route";
import * as owner from "@/app/api/appointments/owner/route";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
const auth = vi.hoisted(()=>({isAuthenticated:vi.fn(async()=>false)}));
vi.mock("@/lib/auth",async original=>({...await original<typeof import("@/lib/auth")>(),...auth}));
const service = vi.hoisted(()=>({maiaAppointment:vi.fn(async()=>({version:1,ok:true,operation:"availability",slots:[]})),ownerAppointment:vi.fn(async()=>({id:"ok"}))}));
vi.mock("@/server/appointments",async original=>({...await original<typeof import("@/server/appointments")>(),...service}));
const token="test-only-credential-not-real-123456789";
const payload={version:1,operation:"availability",contact_id:"11111111-1111-4111-8111-111111111111",args:{}};
const req=(path:string,body:unknown=payload,headers:Record<string,string>={})=>new Request(`https://orbita.invalid/api/appointments/${path}`,{method:"POST",headers:{"content-type":"application/json",...headers},body:JSON.stringify(body)});
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();auth.isAuthenticated.mockResolvedValue(false);});
it.each([undefined,"","*","true","false","not-a-uuid","11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222"])("requires one valid pilot contact before service I/O: %s",async pilot=>{
 vi.stubEnv("MAIA_APPOINTMENTS_ENABLED","true");vi.stubEnv("MAIA_APPOINTMENTS_TOKEN",token);
 vi.stubEnv("MAIA_APPOINTMENTS_PILOT_CONTACT_ID",pilot);
 const response=await maia.POST(req("maia",payload,{authorization:`Bearer ${token}`}));
 expect(response.status).toBe(503);expect(await response.json()).toEqual({version:1,ok:false,error:"unavailable"});
 expect(service.maiaAppointment).not.toHaveBeenCalled();
});
it.each(["list","availability","book","cancel","reschedule"])("denies another contact before service I/O for %s",async operation=>{
 vi.stubEnv("MAIA_APPOINTMENTS_ENABLED","true");vi.stubEnv("MAIA_APPOINTMENTS_TOKEN",token);vi.stubEnv("MAIA_APPOINTMENTS_PILOT_CONTACT_ID",payload.contact_id);
 const args=operation==="book" ? {start_at:"2026-11-09T13:00:00-03:00",mode:"remote",subject:"synthetic"} : operation==="cancel" ? {appointment_id:payload.contact_id} : operation==="reschedule" ? {appointment_id:payload.contact_id,start_at:"2026-11-09T13:00:00-03:00"} : {};
 const response=await maia.POST(req("maia",{...payload,operation,args,contact_id:"22222222-2222-4222-8222-222222222222"},{authorization:`Bearer ${token}`}));
 expect(response.status).toBe(403);expect(await response.json()).toEqual({version:1,ok:false,error:"forbidden"});
 expect(service.maiaAppointment).not.toHaveBeenCalled();
});
it.each([undefined,"","false","TRUE","True","1"])("rejects nonliteral enabled gate %s with valid pilot",async enabled=>{
 vi.stubEnv("MAIA_APPOINTMENTS_ENABLED",enabled);vi.stubEnv("MAIA_APPOINTMENTS_TOKEN",token);vi.stubEnv("MAIA_APPOINTMENTS_PILOT_CONTACT_ID",payload.contact_id);
 expect((await maia.POST(req("maia",payload,{authorization:`Bearer ${token}`}))).status).toBe(503);
 expect(service.maiaAppointment).not.toHaveBeenCalled();
});
it.each([null,[],{}, {...payload,contact_id:true},{...payload,contact_id:"not-uuid"}])("rejects malformed request without service I/O %j",async body=>{
 vi.stubEnv("MAIA_APPOINTMENTS_ENABLED","true");vi.stubEnv("MAIA_APPOINTMENTS_TOKEN",token);vi.stubEnv("MAIA_APPOINTMENTS_PILOT_CONTACT_ID",payload.contact_id);
 expect((await maia.POST(req("maia",body,{authorization:`Bearer ${token}`}))).status).toBe(400);
 expect(service.maiaAppointment).not.toHaveBeenCalled();
});
it("denies dormant and unauthenticated service requests before any DB action",async()=>{
 expect(maia.POST).toBeTypeOf("function");
 expect((await maia.POST(req("maia"))).status).toBe(503);
 vi.stubEnv("MAIA_APPOINTMENTS_ENABLED","true");vi.stubEnv("MAIA_APPOINTMENTS_TOKEN",token);vi.stubEnv("MAIA_APPOINTMENTS_PILOT_CONTACT_ID",payload.contact_id);
 expect((await maia.POST(req("maia"))).status).toBe(401);
 expect((await maia.POST(req("maia",payload,{authorization:`Bearer ${token}`}))).status).toBe(200);
 expect(service.maiaAppointment).toHaveBeenCalledOnce();expect(service.maiaAppointment).toHaveBeenCalledWith(payload);
 expect((await proxy(new NextRequest("https://orbita.invalid/api/appointments/maia"))).headers.get("x-middleware-next")).toBe("1");
});
it("rejects short tokens and returns fixed private errors without internal details",async()=>{
 vi.stubEnv("MAIA_APPOINTMENTS_ENABLED","true");vi.stubEnv("MAIA_APPOINTMENTS_TOKEN","too-short");vi.stubEnv("MAIA_APPOINTMENTS_PILOT_CONTACT_ID",payload.contact_id);
 expect((await maia.POST(req("maia",payload,{authorization:"Bearer too-short"}))).status).toBe(503);
 expect(service.maiaAppointment).not.toHaveBeenCalled();
 vi.stubEnv("MAIA_APPOINTMENTS_TOKEN",token);
 service.maiaAppointment.mockRejectedValueOnce(new Error("Private meeting title and database connection"));
 const response=await maia.POST(req("maia",payload,{authorization:`Bearer ${token}`}));
 expect(response.status).toBe(503);expect(await response.json()).toEqual({version:1,ok:false,error:"unavailable"});
 expect((await proxy(new NextRequest("https://orbita.invalid/api/appointments/owner",{headers:{authorization:`Bearer ${token}`}}))).status).toBe(401);
});
it("uses configured canonical APP_URL behind Next internal request URLs without trusting spoofed forwarded hosts",async()=>{
 auth.isAuthenticated.mockResolvedValue(true);vi.stubEnv("APP_URL","https://orbita.invalid");
 const body={id:"11111111-1111-4111-8111-111111111111",version:1,operation:"reject"};
 const internal=(origin:string)=>new Request("http://localhost:3000/api/appointments/owner",{method:"POST",headers:{origin,"content-type":"application/json","x-forwarded-host":"evil.invalid","x-forwarded-proto":"https"},body:JSON.stringify(body)});
 expect((await owner.POST(internal("https://orbita.invalid"))).status).toBe(200);
 expect((await owner.POST(internal("https://evil.invalid"))).status).toBe(403);
});
it("owner mutations require a live owner session and same-origin JSON, never the Maia token",async()=>{
 expect(owner.POST).toBeTypeOf("function");
 expect((await owner.POST(req("owner",{}, {authorization:`Bearer ${token}`,origin:"https://orbita.invalid"}))).status).toBe(401);
 auth.isAuthenticated.mockResolvedValue(true);
 expect((await owner.POST(req("owner",{}))).status).toBe(403);
 expect((await owner.POST(req("owner",{},{origin:"https://evil.invalid"}))).status).toBe(403);
 expect((await owner.POST(req("owner",{id:"11111111-1111-4111-8111-111111111111",version:1,operation:"reject"},{origin:"https://orbita.invalid"}))).status).toBe(200);
 expect(service.ownerAppointment).toHaveBeenCalledOnce();
});
