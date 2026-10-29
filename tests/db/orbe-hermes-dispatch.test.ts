import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { agentTokens, dispatches, settings, tasks } from "@/db/schema";
import { pedirAgente, statusAgentes } from "@/server/orbe-tools";
import { runAssistantTool } from "@/server/assistant";
import { eq } from "drizzle-orm";
import { agentTasks } from "@/server/agents";
import { proposalTasks, proposalSource } from "@/server/proposals";

beforeEach(async () => {
  const db = await getDb();
  await db.delete(dispatches); await db.delete(tasks); await db.delete(agentTokens);
  await db.insert(agentTokens).values({ name: "Hermes Oracle", tokenHash: "hermes-test", prefix: "orb_h", scopes: ["admin"] });
  await db.insert(settings).values({key:"hermes-task-dispatch", value:{enabled:true}}).onConflictDoUpdate({target:settings.key,set:{value:{enabled:true}}});
  vi.stubEnv("HERMES_DISPATCH_ENABLED", "true");
  vi.stubEnv("HERMES_WEBHOOK_URL", "https://hermes.example/webhooks/orbita-hermes");
  vi.stubEnv("HERMES_WEBHOOK_SECRET", "test");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("ORBE despacha execução preservando contexto e repete sem duplicar tarefa ou envio", async () => {
  const fetcher = vi.fn(async (_url, init) => {
    const body = JSON.parse(init.body);
    expect(body.action).toBe("task.dispatch");
    expect(body.params.brief).toContain("Cloudflare já alterado; atualizar monitores e backlinks.");
    return Response.json({request_id:body.request_id, action:body.action, status:"accepted"}, {status:202});
  });
  vi.stubGlobal("fetch", fetcher);
  const input = {agente:"Hermes Oracle", pedido:"Atualizar domínios", detalhe:"Cloudflare já alterado; atualizar monitores e backlinks."};
  const first = await pedirAgente.run(input);
  expect(first.text).toContain("accepted");
  expect(first.text).toContain("Admissão não comprova");
  expect(await pedirAgente.run(input)).toEqual(first);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const db = await getDb();
  expect(await db.select().from(tasks)).toHaveLength(1);
  const [dispatch] = await db.select().from(dispatches);
  expect(dispatch.origin).toMatchObject({kind:"ui", id:"owner", name:"Antonio"});
});

it("reutiliza tarefa existente e preserva envio incerto sem repetir", async () => {
  const db = await getDb(), id = crypto.randomUUID();
  await db.insert(tasks).values({id,title:"Domínios",scope:"empresa",status:"todo"});
  const fetcher = vi.fn(async () => { throw new Error("timeout"); }); vi.stubGlobal("fetch", fetcher);
  const input = {agente:"Hermes Oracle",tarefa_id:id,pedido:"Atualizar monitores"};
  const first = await pedirAgente.run(input);
  expect(first.text).toContain("unknown"); expect(first.text).toContain(id);
  await pedirAgente.run(input);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(await db.select().from(tasks)).toHaveLength(1);
  expect((await db.select().from(tasks).where(eq(tasks.id,id)))[0].assignee).toBe("Hermes Oracle");
});

it("gate fechado e modo leitura não criam tarefa nem despacham", async () => {
  const db = await getDb(), fetcher = vi.fn(); vi.stubGlobal("fetch",fetcher);
  const input = {agente:"Hermes Oracle",pedido:"Atualizar monitores"};
  expect((await runAssistantTool("pedir_a_agente",input,{scope:"empresa",readOnly:true})).ok).toBe(false);
  vi.stubEnv("HERMES_TASK_DISPATCH_ENABLED","false");
  await expect(pedirAgente.run(input)).rejects.toThrow(/desativado/);
  expect(await db.select().from(tasks)).toHaveLength(0); expect(fetcher).not.toHaveBeenCalled();
});

it("execução delegada não aparece como decisão, mas continua na lista do agente", async () => {
  const db = await getDb();
  await db.insert(tasks).values([
    {title:"Decisão real",scope:"empresa",tags:["agente:hermes-oracle"]},
    {title:"Delegada",scope:"empresa",assignee:"Hermes Oracle",tags:["agente:hermes-oracle","pedido:orbe"]},
    {title:"Já respondida",scope:"empresa",tags:["agente:hermes-oracle","resposta:antonio"]},
  ]);
  expect((await agentTasks()).map(t=>t.title)).toEqual(["Decisão real"]);
  expect((await agentTasks("Hermes Oracle")).map(t=>t.title)).toContain("Delegada");
  const delegated = (await db.select().from(tasks)).find(t=>t.title === "Delegada")!;
  expect((await proposalTasks()).map(t=>t.title)).not.toContain("Delegada");
  expect(await proposalSource({kind:"task",id:delegated.id})).toBeNull();
});

it("consulta retorno nativo correlacionado e mostra conclusão e evidência à ORBE", async () => {
  const db = await getDb(), id = crypto.randomUUID(), taskId = crypto.randomUUID();
  await db.insert(tasks).values({id:taskId,title:"Monitores",scope:"empresa",assignee:"Hermes Oracle",status:"done"});
  await db.insert(dispatches).values({id,target:"hermes",action:"task.dispatch",status:"accepted",params:{task_id:taskId,brief:"Atualizar",acceptance:"Verificar"}});
  const fetcher = vi.fn(async () => Response.json({request_id:id,action:"task.dispatch",status:"completed",result:{task_execution:true,verified:true,task_id:taskId,response_text:"Monitores atualizados e conferidos",session_id:"session-test",evidence:["Readback dos dois novos endereços"]}}));
  vi.stubGlobal("fetch",fetcher);
  const result = await statusAgentes.run({agente:"Hermes Oracle"});
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(result.text).toContain(id); expect(result.text).toContain(taskId);
  expect(result.text).toContain("completed"); expect(result.text).toContain("Readback dos dois novos endereços");
});
