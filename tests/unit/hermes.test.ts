import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
const store = new Map<string, unknown>();
vi.mock("@/server/hermes-store",()=>({storedHermesOperation:vi.fn(async(id:string)=>store.get(`hermes-operation:${id}`)),storedHermesHistory:vi.fn(async()=>[...store.values()]),saveHermesOperation:vi.fn(async(value:{id:string})=>{store.set(`hermes-operation:${value.id}`,value);return value;})}));
import { dispatchHermes, readHermesResult, hermesHeaders, hermesCommand } from "@/server/hermes";
beforeEach(()=>{store.clear();vi.stubEnv("HERMES_DISPATCH_ENABLED","true");vi.stubEnv("HERMES_WEBHOOK_URL","https://hermes.example/webhooks/orbita-hermes");vi.stubEnv("HERMES_WEBHOOK_SECRET","dedicated-test-secret");});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe("receptor dedicado Hermes",()=>{
 it("restringe análise a texto aparado de 1 a 4000 caracteres, sem campos extras",()=>{
  for(const text of ["", "   ", "x".repeat(4001)])expect(hermesCommand.safeParse({action:"agent.analyze",params:{text}}).success).toBe(false);
  expect(hermesCommand.safeParse({action:"agent.analyze",params:{text:"x".repeat(4000)}}).success).toBe(true);
  for(const extra of [{due_at:123},{tool:"deploy"}])expect(hermesCommand.safeParse({action:"agent.analyze",params:{text:"Teste",...extra}}).success).toBe(false);
 });
 it("não conclui análise sem prova de execução e rejeita estados de lembrete",async()=>{
  let status="completed";let result:unknown={response_text:"Não comprovado",agent_execution:false};
  vi.stubGlobal("fetch",vi.fn(async(_url,init)=>{const body=JSON.parse(init.body);return Response.json({request_id:body.request_id,action:"agent.analyze",status:body.action==="result.read"?status:"accepted",result},{status:body.action==="result.read"?200:202});}));
  const sent=await dispatchHermes({action:"agent.analyze",params:{text:"Analisar"}});
  for(const invalid of [result,null,{response_text:"",agent_execution:true},{response_text:"Sem prova"}]){result=invalid;await expect(readHermesResult(sent.id)).rejects.toThrow();expect(store.get(`hermes-operation:${sent.id}`)).toMatchObject({status:"accepted"});}
  status="scheduled";await expect(readHermesResult(sent.id)).rejects.toThrow();
  for(const terminal of ["failed","interrupted"]){status=terminal;expect(await readHermesResult(sent.id)).toMatchObject({status:terminal});}
 });
 it("aciona análise real com texto aparado e envelope V2, sem lembrete paralelo",async()=>{
  const fetcher=vi.fn(async(_url,init)=>{const body=JSON.parse(init.body);expect(body).toMatchObject({version:2,source:"orbita",action:"agent.analyze",params:{text:"Analisar operação"}});expect(Object.keys(body.params)).toEqual(["text"]);expect(body.request_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);expect(store.has(`hermes-operation:${body.request_id}`)).toBe(true);return Response.json({request_id:body.request_id,action:body.action,status:"accepted"},{status:202});});
  vi.stubGlobal("fetch",fetcher);
  const sent=await dispatchHermes({action:"agent.analyze",params:{text:"  Analisar operação  "}});
  expect(sent).toMatchObject({status:"accepted",text:"Analisar operação"});expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it("consulta análise em execução e guarda apenas retorno comprovado no mesmo UUID",async()=>{
  let status="accepted";
  const fetcher=vi.fn(async(_url,init)=>{const body=JSON.parse(init.body);return Response.json({request_id:body.request_id,action:"agent.analyze",status:body.action==="result.read"?status:"accepted",result:status==="completed"?{response_text:"Análise pronta",agent_execution:true,private_debug:"não expor"}:null},{status:body.action==="result.read"?200:202});});vi.stubGlobal("fetch",fetcher);
  const sent=await dispatchHermes({action:"agent.analyze",params:{text:"Analisar"}});
  status="running";expect(await readHermesResult(sent.id)).toMatchObject({id:sent.id,status:"running",text:"Analisar"});
  status="completed";const done=await readHermesResult(sent.id);expect(done).toMatchObject({id:sent.id,status:"completed",responseText:"Análise pronta",agentExecution:true});expect(JSON.stringify(done)).not.toContain("private_debug");expect(fetcher.mock.calls.map(call=>JSON.parse(call[1].body).action)).toEqual(["agent.analyze","result.read","result.read"]);
 });
 it("preserva bytes de texto do retorno sem aparar Markdown",async()=>{
  const responseText="  análise\n\n";
  vi.stubGlobal("fetch",vi.fn(async(_url,init)=>{const body=JSON.parse(init.body);return Response.json({request_id:body.request_id,action:"agent.analyze",status:body.action==="result.read"?"completed":"accepted",result:{response_text:responseText,agent_execution:true}},{status:body.action==="result.read"?200:202});}));
  const sent=await dispatchHermes({action:"agent.analyze",params:{text:"Analisar"}});
  expect((await readHermesResult(sent.id)).responseText).toBe(responseText);
 });
 it("assina bytes exatos e timestamp sem prefixo legado",()=>{const body='{"text":"ação"}';const headers=hermesHeaders("secret",body,"id",123);expect(headers["X-Webhook-Signature-V2"]).toBe(createHmac("sha256","secret").update(`123.${body}`).digest("hex"));});
 it("persiste antes do envio e consulta usando o mesmo UUID",async()=>{const fetcher=vi.fn(async(_url,init)=>{const body=JSON.parse(init.body);expect(store.has(`hermes-operation:${body.request_id}`)).toBe(true);expect(init.redirect).toBe("manual");return Response.json({request_id:body.request_id,action:"diagnostics.read",status:body.action==="result.read" ? "completed":"accepted"},{status:body.action==="result.read" ? 200:202});});vi.stubGlobal("fetch",fetcher);const sent=await dispatchHermes({action:"diagnostics.read",params:{}});expect(sent.status).toBe("accepted");const result=await readHermesResult(sent.id);expect(result.status).toBe("completed");expect(JSON.parse(fetcher.mock.calls[1][1].body).request_id).toBe(sent.id);expect(JSON.stringify(result)).not.toContain("dedicated-test-secret");});
 it("reconhece lembrete agendado na consulta do receptor",async()=>{const fetcher=vi.fn(async(_url,init)=>{const body=JSON.parse(init.body);return Response.json({request_id:body.request_id,action:"reminder.internal",status:body.action==="result.read" ? "scheduled":"accepted"},{status:body.action==="result.read" ? 200:202});});vi.stubGlobal("fetch",fetcher);const sent=await dispatchHermes({action:"reminder.internal",params:{text:"Revisar integração",due_at:Math.floor(Date.now()/1000)+3600}});expect((await readHermesResult(sent.id)).status).toBe("scheduled");});
 it("não repete timeout e conserva identificador para reconciliação",async()=>{const fetcher=vi.fn(async()=>{throw new Error("transport");});vi.stubGlobal("fetch",fetcher);const result=await dispatchHermes({action:"diagnostics.read",params:{}});expect(result.status).toBe("unknown");expect(fetcher).toHaveBeenCalledTimes(1);expect(store.has(`hermes-operation:${result.id}`)).toBe(true);});
 it("recusa contrato ampliado, lembrete vencido e ativação ausente",async()=>{const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);await expect(dispatchHermes({action:"reminder.internal",params:{text:"teste",due_at:1}})).rejects.toThrow();vi.stubEnv("HERMES_DISPATCH_ENABLED","false");expect((await dispatchHermes({action:"diagnostics.read",params:{}})).status).toBe("unknown");expect(fetcher).not.toHaveBeenCalled();});
 it("não aceita redirect ou UUID divergente como admissão",async()=>{vi.stubGlobal("fetch",vi.fn(async()=>new Response(null,{status:302})));expect((await dispatchHermes({action:"diagnostics.read",params:{}})).status).toBe("unknown");vi.stubGlobal("fetch",vi.fn(async()=>Response.json({request_id:"other",status:"accepted",action:"diagnostics.read"},{status:202})));expect((await dispatchHermes({action:"diagnostics.read",params:{}})).status).toBe("unknown");});
});
