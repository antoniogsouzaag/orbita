import { afterEach, expect, it, vi } from "vitest";
import { configureHermesWork, hermesWorkEnabled } from "@/server/hermes-work";
const admin = {kind:"mcp" as const,id:"admin-test",name:"Admin",scopes:["admin" as const]};
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it("gate defaults false, requires admin and signed correlated capability, persists readback; off always allowed",async()=>{
 expect(await hermesWorkEnabled()).toBe(false);
 await expect(configureHermesWork({...admin,scopes:["tarefas"]},true)).rejects.toThrow(/admin/);
 vi.stubEnv("HERMES_DISPATCH_ENABLED","true"); vi.stubEnv("HERMES_WEBHOOK_URL","https://hermes.example/webhooks/orbita-hermes");vi.stubEnv("HERMES_WEBHOOK_SECRET","test");
 let ready=false;
 const fetcher=vi.fn(async (_url,init)=>{const b=JSON.parse(init.body);expect(b.action).toBe("diagnostics.read");expect(init.headers["X-Webhook-Signature-V2"]).toBeTruthy();return Response.json({request_id:b.request_id,action:b.action,status:"accepted",task_dispatch_ready:ready},{status:202});});vi.stubGlobal("fetch",fetcher);
 await expect(configureHermesWork(admin,true)).rejects.toThrow(/capacidade/);expect(await hermesWorkEnabled()).toBe(false);
 for(const patch of [{task_dispatch_ready:undefined},{task_dispatch_ready:"true"},{request_id:crypto.randomUUID()},{action:"task.dispatch"},{status:"completed"}]) {
  vi.stubGlobal("fetch",vi.fn(async (_url,init)=>{const b=JSON.parse(init.body);return Response.json({request_id:b.request_id,action:b.action,status:"accepted",task_dispatch_ready:true,...patch},{status:202});}));
  await expect(configureHermesWork(admin,true)).rejects.toThrow();expect(await hermesWorkEnabled()).toBe(false);
 }
 vi.stubGlobal("fetch",fetcher);
 ready=true;expect(await configureHermesWork(admin,true)).toEqual({enabled:true});expect(await hermesWorkEnabled()).toBe(true);
 vi.stubEnv("HERMES_TASK_DISPATCH_ENABLED","false");expect(await hermesWorkEnabled()).toBe(false);
 vi.stubGlobal("fetch",vi.fn(()=>{throw new Error("offline");}));expect(await configureHermesWork(admin,false)).toEqual({enabled:false});
});
