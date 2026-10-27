import { expect, it, vi, afterEach } from "vitest";
import { getDb } from "@/db";
import { tasks, dispatches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { dispatchMaintenance } from "@/server/hermes-maintenance";
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it("aceita tarefa existente sem duplicar e desfaz reserva para escopo ou responsável inválido",async()=>{
 vi.stubEnv("HERMES_DISPATCH_ENABLED","true");vi.stubEnv("HERMES_WEBHOOK_URL","https://hermes.example/webhooks/orbita-hermes");vi.stubEnv("HERMES_WEBHOOK_SECRET","test");
 const db=await getDb();const fetcher=vi.fn(async(_url,init)=>{const body=JSON.parse(init.body);return Response.json({request_id:body.request_id,action:body.action,status:"accepted"},{status:202});});vi.stubGlobal("fetch",fetcher);
 for(const [scope,status,assignee,allowed] of [["empresa","todo",null,true],["pessoal","todo",null,false],["empresa","done",null,false],["empresa","doing","Tom",false]] as const){
  const taskId=crypto.randomUUID(),requestId=crypto.randomUUID();await db.insert(tasks).values({id:taskId,title:"Existente",scope,status,assignee});
  const work=dispatchMaintenance({requestId,operation:"maia.recover",task:{id:taskId}});
  if(allowed)expect(await work).toMatchObject({taskId,status:"accepted"});else {await expect(work).rejects.toThrow();expect(await db.select().from(dispatches).where(eq(dispatches.id,requestId))).toHaveLength(0);}
 }
 expect(fetcher).toHaveBeenCalledTimes(1);
});
it("cria tarefa empresa explicitamente antes do envio; retry incerto não recria nem reenvia",async()=>{
 vi.stubEnv("HERMES_DISPATCH_ENABLED","true");vi.stubEnv("HERMES_WEBHOOK_URL","https://hermes.example/webhooks/orbita-hermes");vi.stubEnv("HERMES_WEBHOOK_SECRET","test");
 const id=crypto.randomUUID();const db=await getDb();
 const fetcher=vi.fn(async()=>{expect(await db.select().from(tasks).where(eq(tasks.id,id))).toHaveLength(1);expect(await db.select().from(dispatches).where(eq(dispatches.id,id))).toHaveLength(1);throw new Error("timeout");});vi.stubGlobal("fetch",fetcher);
 const input={requestId:id,operation:"maia.recover" as const,task:{create:true as const,notes:"Maia indisponível"}};
 expect(await dispatchMaintenance(input)).toMatchObject({id,taskId:id,status:"unknown"});
 expect(await dispatchMaintenance(input)).toMatchObject({id,taskId:id,status:"unknown"});
 expect(fetcher).toHaveBeenCalledTimes(1);
 const [task]=await db.select().from(tasks).where(eq(tasks.id,id));expect(task).toMatchObject({scope:"empresa",status:"todo",assignee:null,title:"Recuperar Maia",notes:"Maia indisponível"});
 await expect(dispatchMaintenance({...input,operation:"monitor.domain.ensure",domain:"example.com"})).rejects.toThrow();
});
