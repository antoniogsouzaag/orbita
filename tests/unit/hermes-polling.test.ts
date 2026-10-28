// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HermesIntegration } from "@/components/agents/hermes-integration";
import { checkHermes, sendHermes } from "@/app/actions/hermes";
import type { HermesOperation } from "@/server/hermes";
vi.mock("@/app/actions/hermes",()=>({sendHermes:vi.fn(),checkHermes:vi.fn()}));
vi.mock("sonner",()=>({toast:Object.assign(vi.fn(),{error:vi.fn()})}));
let host:HTMLDivElement;let mounted:Root;
const config={enabled:true,endpointConfigured:true,secretConfigured:true};
const operation:HermesOperation={id:"analysis",action:"agent.analyze",text:"Analisar",status:"accepted",detail:"Recebido",createdAt:new Date().toISOString(),checkedAt:new Date().toISOString()};
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.useFakeTimers();vi.clearAllMocks();host=document.createElement("div");document.body.append(host);mounted=createRoot(host);});
afterEach(async()=>{await act(async()=>mounted.unmount());host.remove();vi.useRealTimers();});
const tick=async()=>{await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});};
it("consulta trabalho genérico ativo e renderiza prova como texto sem executar HTML",async()=>{
 const task:HermesOperation={...operation,id:"task",action:"task.dispatch",taskId:"12345678-1234-4234-8234-123456789abc"};
 vi.mocked(checkHermes).mockResolvedValue({...task,status:"completed",taskExecution:true,verified:true,responseText:"<script>Teste real</script>"});
 await act(async()=>mounted.render(React.createElement(HermesIntegration,{config,initial:[task]})));
 await tick();expect(checkHermes).toHaveBeenCalledExactlyOnceWith("task");expect(host.textContent).toContain("<script>Teste real</script>");expect(host.querySelector("script")).toBeNull();
 await tick();expect(checkHermes).toHaveBeenCalledTimes(1);
});
it("consulta manutenção ativa e mostra somente retorno verificado, com limite no histórico",async()=>{
 const maintenance:HermesOperation={...operation,id:"maintenance",action:"maintenance.execute",taskId:"12345678-1234-4234-8234-123456789abc",maintenanceOperation:"maia.recover"};
 vi.mocked(checkHermes).mockResolvedValue({...maintenance,status:"completed",responseText:"Maia recuperada",maintenanceExecution:true,verified:true,changed:true});
 await act(async()=>mounted.render(React.createElement(HermesIntegration,{config,initial:[maintenance]})));
 await tick();expect(checkHermes).toHaveBeenCalledExactlyOnceWith("maintenance");expect(host.textContent).toContain("Maia recuperada");
 await tick();expect(checkHermes).toHaveBeenCalledTimes(1);
});
it("consulta apenas análises ativas e para ao concluir sem reenviar",async()=>{
 vi.mocked(checkHermes).mockResolvedValueOnce({...operation,status:"running"}).mockResolvedValueOnce({...operation,status:"completed",responseText:"Pronta",agentExecution:true});
 await act(async()=>mounted.render(React.createElement(HermesIntegration,{config,initial:[operation,{...operation,id:"legacy",action:"reminder.internal"}]})));
 await tick();expect(checkHermes).toHaveBeenCalledExactlyOnceWith("analysis");await tick();expect(host.textContent).toContain("Pronta");await tick();expect(checkHermes).toHaveBeenCalledTimes(2);expect(sendHermes).not.toHaveBeenCalled();
});
it("limita a doze consultas por análise durante a montagem e deixa consulta manual disponível",async()=>{
 vi.mocked(checkHermes).mockResolvedValue({...operation,status:"running"});
 await act(async()=>mounted.render(React.createElement(HermesIntegration,{config,initial:[operation]})));
 for(let i=0;i<15;i++)await tick();expect(checkHermes).toHaveBeenCalledTimes(12);expect(host.textContent).toContain("Consultar resultado");expect(host.textContent).toContain("Limite de consultas automáticas atingido");
});
it("para após erro sem reenviar e não consulta quando despacho desabilitado",async()=>{
 vi.mocked(checkHermes).mockRejectedValue(new Error("offline"));
 await act(async()=>mounted.render(React.createElement(HermesIntegration,{config,initial:[operation]})));
 await tick();await tick();expect(checkHermes).toHaveBeenCalledTimes(1);expect(sendHermes).not.toHaveBeenCalled();
 await act(async()=>mounted.render(React.createElement(HermesIntegration,{config:{...config,enabled:false},initial:[operation]})));
 await tick();expect(checkHermes).toHaveBeenCalledTimes(1);
});
