import { expect, it, vi, beforeEach, afterEach } from "vitest";
import type { HermesOperation } from "@/server/hermes";
const rows = new Map<string, HermesOperation>();
vi.mock("@/server/hermes-store",()=>({storedHermesOperation:async(id:string)=>rows.get(id),storedHermesHistory:async()=>[...rows.values()],saveHermesOperation:async(v:HermesOperation)=>{rows.set(v.id,v);return v;}}));
vi.mock("@/server/hermes-maintenance-tasks",()=>({validateMaintenanceTask:vi.fn(async()=>{})}));
import { dispatchHermes, readHermesResult, hermesCommand } from "@/server/hermes";
const task_id="12345678-1234-4234-8234-123456789abc";
beforeEach(()=>{rows.clear();vi.stubEnv("HERMES_DISPATCH_ENABLED","true");vi.stubEnv("HERMES_WEBHOOK_URL","https://hermes.example/webhooks/orbita-hermes");vi.stubEnv("HERMES_WEBHOOK_SECRET","test");});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it("despacha manutenção exata, persistida antes do envio e correlaciona conclusão verificada à tarefa",async()=>{
 let result:Record<string,unknown>={response_text:"Recuperada",maintenance_execution:true,verified:true,changed:false,task_id};
 vi.stubGlobal("fetch",vi.fn(async(_u,init)=>{const body=JSON.parse(init.body);expect(rows.has(body.request_id)).toBe(true);return Response.json({request_id:body.request_id,action:"maintenance.execute",status:body.action==="result.read"?"completed":"accepted",result},{status:body.action==="result.read"?200:202});}));
 const sent=await dispatchHermes({action:"maintenance.execute",params:{task_id,operation:"maia.recover"}});
 expect(sent).toMatchObject({status:"accepted",taskId:task_id,maintenanceOperation:"maia.recover"});
 for(const invalid of [{...result,verified:false},{...result,maintenance_execution:false},{...result,task_id:crypto.randomUUID()},{...result,changed:undefined}]) {const valid=result;result=invalid;await expect(readHermesResult(sent.id)).rejects.toThrow();result=valid;}
 expect(await readHermesResult(sent.id)).toMatchObject({status:"completed",maintenanceExecution:true,verified:true,changed:false,taskId:task_id,responseText:"Recuperada"});
});
it("recusa campos extras, domínio não DNS/minúsculo e UUID não v4",()=>{
 const command=(params:unknown)=>hermesCommand.safeParse({action:"maintenance.execute",params}).success;
 for (const domain of ["example.br", "example.com.br", "example.api.br", "example.ia.br", "example.app.br", "a.br", `${"a".repeat(63)}.br`]) expect(command({task_id,operation:"monitor.domain.ensure",domain}), domain).toBe(true);
 for (const domain of ["example.com", "example.org", "example.net", "example.org.br", "example.net.br", "example.dev.br", "www.example.br", "www.example.com.br", "xn--exemplo.br", "xn--exemplo.com.br", "exémplo.br", "EXAMPLE.br", "example.br.", `${"a".repeat(64)}.br`]) expect(command({task_id,operation:"monitor.domain.ensure",domain}), domain).toBe(false);
 for(const domain of ["EXAMPLE.com","https://example.com","localhost","127.0.0.1","a..com","-a.com","a.com/","a.com;id","co.uk","com.br","www.example.com","example.invalid"])expect(command({task_id,operation:"monitor.domain.ensure",domain})).toBe(false);
 for(const params of [{task_id,operation:"maia.recover",domain:"a.com"},{task_id,operation:"shell",command:"ls"},{task_id:"12345678-1234-1234-8234-123456789abc",operation:"maia.recover"}])expect(command(params)).toBe(false);
});
