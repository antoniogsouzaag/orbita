import { afterEach, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { tasks, dispatches, settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { dispatchWork } from "@/server/hermes-work";
import { readHermesResult, hermesCommand, dispatchHermes } from "@/server/hermes";
import { storedHermesOperation } from "@/server/hermes-store";
const actor = { kind: "mcp" as const, id: "test-authenticated-token", name: "Outro agente", scopes: ["tarefas" as const] };
it("generic gate defaults closed before any task or reservation", async () => {
 const db = await getDb(); const beforeTasks = await db.select().from(tasks); const beforeDispatches = await db.select().from(dispatches);
 await (await getDb()).insert(settings).values({key:"hermes-task-dispatch",value:{enabled:true}}).onConflictDoUpdate({target:settings.key,set:{value:{enabled:true}}}); vi.stubEnv("HERMES_DISPATCH_ENABLED", "true"); vi.stubEnv("HERMES_TASK_DISPATCH_ENABLED", "false");
 await expect(dispatchWork(actor, {title:"Disabled",brief:"Do not reserve",acceptance:"No writes"})).rejects.toThrow(/HERMES_TASK_DISPATCH_ENABLED/);
 expect(await db.select().from(tasks)).toEqual(beforeTasks); expect(await db.select().from(dispatches)).toEqual(beforeDispatches);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("reserva tarefa, atribuição e despacho antes da rede; retry incerto preserva UUID sem reenviar", async () => {
 const db = await getDb();
 await (await getDb()).insert(settings).values({key:"hermes-task-dispatch",value:{enabled:true}}).onConflictDoUpdate({target:settings.key,set:{value:{enabled:true}}}); vi.stubEnv("HERMES_DISPATCH_ENABLED", "true"); vi.stubEnv("HERMES_WEBHOOK_URL", "https://hermes.example/webhooks/orbita-hermes"); vi.stubEnv("HERMES_WEBHOOK_SECRET", "test");
 const fetcher = vi.fn(async (_url, init) => {
  const body = JSON.parse(init.body);
  expect(body.action).toBe("task.dispatch");
  expect(Object.keys(body.params).sort()).toEqual(["acceptance", "brief", "task_id"]);
  const [task] = await db.select().from(tasks).where(eq(tasks.id, body.params.task_id));
  expect(task).toMatchObject({ scope: "empresa", assignee: "Hermes Oracle", title: "Investigar fila" });
  const [dispatch] = await db.select().from(dispatches).where(eq(dispatches.id, body.request_id));
  expect(dispatch.origin).toMatchObject({ kind: "mcp", id: actor.id, name: actor.name });
  throw new Error("timeout");
 }); vi.stubGlobal("fetch", fetcher);
 const input = { title: "Investigar fila", brief: " Investigue o problema da fila ", acceptance: "Teste e evidência" };
 const first = await dispatchWork(actor, input);
 expect(first).toMatchObject({ status: "unknown", action: "task.dispatch" });
 expect(await dispatchWork(actor, input)).toMatchObject({ id: first.id, taskId: first.taskId, status: "unknown" });
 expect(fetcher).toHaveBeenCalledTimes(1);
});
it("recusa grants insuficientes, escopo pessoal, tarefas fechadas/de outro dono e campos de controle",async()=>{
 const db=await getDb(); await db.insert(settings).values({key:"hermes-task-dispatch",value:{enabled:true}}).onConflictDoUpdate({target:settings.key,set:{value:{enabled:true}}}); const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
 const input={title:"Seguro",brief:"Investigue",acceptance:"Teste"};
 await expect(dispatchWork({...actor,scopes:["status"]},input)).rejects.toThrow(/Escopo/);
 for(const field of ["profile","model","tools","path","flags","resources","origin","command"]) await expect(dispatchWork(actor,{...input,[field]:"injetado"})).rejects.toThrow();
 for(const [scope,status,assignee] of [["pessoal","todo",null],["empresa","done",null],["empresa","todo","Tom"]] as const){
  const id=crypto.randomUUID();await db.insert(tasks).values({id,title:"Protegida",scope,status,assignee});
  await expect(dispatchWork(actor,{task_id:id,brief:"Investigue",acceptance:"Teste"})).rejects.toThrow();
 }
 expect(fetcher).not.toHaveBeenCalled();
 for(const params of [{task_id:crypto.randomUUID(),brief:"x",acceptance:"y",model:"bad"},{task_id:"12345678-1234-1234-8234-123456789abc",brief:"x",acceptance:"y"},{task_id:crypto.randomUUID(),brief:"x".repeat(12001),acceptance:"y"}]) expect(hermesCommand.safeParse({action:"task.dispatch",params}).success).toBe(false);
 await expect(dispatchHermes({action:"task.dispatch",params:{task_id:crypto.randomUUID(),brief:"x",acceptance:"y"}})).rejects.toThrow(/task-backed/);
});
it("concorrência cria uma reserva e uma tarefa e serializa vínculo exclusivo por tarefa",async()=>{
 await (await getDb()).insert(settings).values({key:"hermes-task-dispatch",value:{enabled:true}}).onConflictDoUpdate({target:settings.key,set:{value:{enabled:true}}}); vi.stubEnv("HERMES_DISPATCH_ENABLED","true");vi.stubEnv("HERMES_WEBHOOK_URL","https://hermes.example/webhooks/orbita-hermes");vi.stubEnv("HERMES_WEBHOOK_SECRET","test");
 const fetcher=vi.fn(async()=>{throw new Error("timeout");});vi.stubGlobal("fetch",fetcher);
 const input={title:"Concorrente",brief:"Investigue concorrência",acceptance:"Uma reserva"};
 const results=await Promise.all([dispatchWork(actor,input),dispatchWork(actor,input),dispatchWork(actor,input)]);
 expect(new Set(results.map(x=>x.id)).size).toBe(1);expect(new Set(results.map(x=>x.taskId)).size).toBe(1);expect(fetcher).toHaveBeenCalledTimes(1);
 const db=await getDb();const [task]=await db.select().from(tasks).where(eq(tasks.id,results[0].taskId!));expect(task.title).toBe(input.title);
 const id=crypto.randomUUID();await db.insert(tasks).values({id,title:"Existente",scope:"empresa",status:"todo"});
 const same=await Promise.all([dispatchWork(actor,{task_id:id,brief:"A",acceptance:"Teste"}),dispatchWork(actor,{task_id:id,brief:"B",acceptance:"Teste"})]);
 expect(same[0].id).toBe(same[1].id);expect(fetcher).toHaveBeenCalledTimes(2);
});
it("conclusão genérica exige prova correlacionada e persiste apenas evidência limitada", async () => {
 const db = await getDb(), id = crypto.randomUUID(), taskId = crypto.randomUUID();
 await db.insert(dispatches).values({ id, target: "hermes", action: "task.dispatch", status: "accepted", params: { task_id: taskId, brief: "Verificar", acceptance: "Teste" } });
 await (await getDb()).insert(settings).values({key:"hermes-task-dispatch",value:{enabled:true}}).onConflictDoUpdate({target:settings.key,set:{value:{enabled:true}}}); vi.stubEnv("HERMES_DISPATCH_ENABLED", "true"); vi.stubEnv("HERMES_WEBHOOK_URL", "https://hermes.example/webhooks/orbita-hermes"); vi.stubEnv("HERMES_WEBHOOK_SECRET", "test");
 const valid = { task_execution: true, verified: true, task_id: taskId, response_text: "  Testado\n", session_id: "session-123", evidence: ["Teste executado"] };
 let result: unknown = valid;
 vi.stubGlobal("fetch", vi.fn(async () => Response.json({ request_id: id, action: "task.dispatch", status: "completed", result })));
 for (const invalid of [{ ...valid, session_id: undefined }, { ...valid, session_id: "bad session" }, { ...valid, evidence: undefined }, { ...valid, evidence: [] }, { ...valid, evidence: [" "] }, { ...valid, extra: true }, { ...valid, task_execution: false }, { ...valid, verified: false }, { ...valid, task_id: crypto.randomUUID() }, { ...valid, evidence: ["x".repeat(2001)] }, { ...valid, response_text: " " }]) {
  result = invalid; await expect(readHermesResult(id)).rejects.toThrow();
  expect(await storedHermesOperation(id)).toMatchObject({ status: "accepted" });
 }
 result = valid;
 await expect(readHermesResult(id)).rejects.toThrow(/tarefa/);
 await db.insert(tasks).values({id:taskId,title:"Executed",scope:"empresa",assignee:"Hermes Oracle",status:"done"});
 expect(await readHermesResult(id)).toMatchObject({ status: "completed", taskExecution: true, verified: true, taskId, responseText: valid.response_text, sessionId: "session-123", evidence: valid.evidence });
 expect(await storedHermesOperation(id)).toMatchObject({ taskExecution: true, verified: true, responseText: valid.response_text });
});
