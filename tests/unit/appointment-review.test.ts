// @vitest-environment jsdom
import * as React from "react";
import {act} from "react";
import {createRoot} from "react-dom/client";
import {expect,it,vi} from "vitest";
import {AppointmentReview} from "@/components/agenda/appointment-review";
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn()})}));
it("shows unconfirmed presencial, explicit buffers and sends a single versioned review",async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const host=document.createElement("div");document.body.append(host);const root=createRoot(host);
 let release!:(r:Response)=>void;
 const fetcher=vi.fn<(url:string,options:RequestInit)=>Promise<Response>>(()=>new Promise<Response>(r=>{release=r;}));vi.stubGlobal("fetch",fetcher);
 try{
  await act(async()=>root.render(React.createElement(AppointmentReview,{items:[{id:"11111111-1111-4111-8111-111111111111",contactId:"22222222-2222-4222-8222-222222222222",customerName:"Cliente teste",mode:"in_person",subject:"Consulta",state:"pending_approval",startAt:"2026-11-05T12:00:00Z",endAt:"2026-11-05T12:45:00Z",address:"Teste",remotePreference:null,travelBefore:0,travelAfter:0,version:1,history:[{version:1,actor:"maia",operation:"book",createdAt:"2026-11-05T08:00:00Z"}]}],crmBase:"https://crm.invalid"})));
  expect(host.textContent).toContain("não confirmado");expect(host.textContent).toContain("22222222-2222-4222-8222-222222222222");
  const inputs=host.querySelectorAll<HTMLInputElement>('input[type="number"]');expect(inputs).toHaveLength(2);expect(inputs[0].value).toBe("");
  await act(async()=>{for(const field of inputs){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(field,"0");field.dispatchEvent(new Event("input",{bubbles:true}));}});
  const approve=[...host.querySelectorAll("button")].find(b=>b.textContent==="Aprovar presencial")!;
  await act(async()=>{approve.click();approve.click();});
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(JSON.parse(String(fetcher.mock.calls[0][1].body))).toEqual({id:"11111111-1111-4111-8111-111111111111",version:1,operation:"approve",travel_before:0,travel_after:0});
  expect(approve.disabled).toBe(true);
  await act(async()=>release(new Response(JSON.stringify({ok:false,error:"version_conflict"}),{status:409})));
  expect(host.textContent).toContain("version_conflict");
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
