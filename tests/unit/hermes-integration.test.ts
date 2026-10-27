// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HermesIntegration } from "@/components/agents/hermes-integration";
import { sendHermes, checkHermes } from "@/app/actions/hermes";
vi.mock("@/app/actions/hermes",()=>({sendHermes:vi.fn(),checkHermes:vi.fn()}));
vi.mock("sonner",()=>({toast:Object.assign(vi.fn(),{error:vi.fn()})}));
vi.mock("@/components/ui/dialog",()=>({Dialog:({open,children}:{open:boolean;children:React.ReactNode})=>open?children:null,DialogContent:({children,title,description}:{children:React.ReactNode;title:string;description:string})=>React.createElement("section",null,title,description,children)}));
let host: HTMLDivElement;
let mounted: Root;
const config={enabled:true,endpointConfigured:true,secretConfigured:true};
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});host=document.createElement("div");document.body.append(host);mounted=createRoot(host);vi.clearAllMocks();});
afterEach(async()=>{await act(async()=>mounted.unmount());host.remove();vi.useRealTimers();});
it("não duplica análise quando o formulário é submetido duas vezes antes do React atualizar",async()=>{
 let resolve!: (value: Awaited<ReturnType<typeof sendHermes>>) => void;
 vi.mocked(sendHermes).mockImplementation(()=>new Promise(done=>{resolve=done;}));
 await act(async()=>mounted.render(React.createElement(HermesIntegration,{config,initial:[]})));
 await act(async()=>[...host.querySelectorAll("button")].find(b=>b.textContent==="Acionar Hermes")!.click());
 const text=host.querySelector("textarea")!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!.call(text,"Analisar");text.dispatchEvent(new Event("input",{bubbles:true}));});
 await act(async()=>{const form=host.querySelector("form")!;form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));});
 expect(sendHermes).toHaveBeenCalledTimes(1);
 await act(async()=>resolve({id:"pending",action:"agent.analyze",status:"accepted",createdAt:new Date().toISOString(),checkedAt:new Date().toISOString(),detail:"Recebido"}));
});
it("aciona análise manual sem prazo nem lembrete e mostra pedido e retorno como texto",async()=>{
 vi.mocked(sendHermes).mockResolvedValue({id:"request",action:"agent.analyze",status:"completed",createdAt:new Date().toISOString(),checkedAt:new Date().toISOString(),detail:"Concluído",text:"Analisar operação",responseText:"<script>retorno</script>",agentExecution:true});
 await act(async()=>mounted.render(React.createElement(HermesIntegration,{config,initial:[]})));
 const trigger=[...host.querySelectorAll("button")].find(b=>b.textContent==="Acionar Hermes");expect(trigger).toBeDefined();
 await act(async()=>trigger!.click());
 expect(host.textContent).toContain("sem mudanças em produção ou clientes");
 expect(host.querySelector('input[type="datetime-local"]')).toBeNull();
 const text=host.querySelector("textarea")!;expect(text.maxLength).toBe(4000);
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!.call(text,"Analisar operação");text.dispatchEvent(new Event("input",{bubbles:true}));});
 await act(async()=>host.querySelector("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
 expect(sendHermes).toHaveBeenCalledExactlyOnceWith({action:"agent.analyze",params:{text:"Analisar operação"}});
 expect(host.textContent).toContain("Analisar operação");expect(host.textContent).toContain("<script>retorno</script>");expect(host.querySelector("script")).toBeNull();expect(checkHermes).not.toHaveBeenCalled();
});
