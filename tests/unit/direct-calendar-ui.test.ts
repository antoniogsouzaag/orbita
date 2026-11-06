// @vitest-environment jsdom
import * as React from "react";
import {act} from "react";
import {createRoot} from "react-dom/client";
import {expect,it,vi} from "vitest";
import {AgendaPage} from "@/components/agenda/agenda-page";
import {AppointmentReview,type ReviewItem} from "@/components/agenda/appointment-review";
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn()})}));
vi.mock("@/app/actions/calendar",()=>({deleteEvent:vi.fn(),saveEvent:vi.fn()}));
vi.mock("@/components/ui/dialog",()=>({Dialog:({children}:{children:React.ReactNode})=>children,DialogContent:({children}:{children:React.ReactNode})=>React.createElement("div",null,children)}));
const id="11111111-1111-4111-8111-111111111111";
const item:ReviewItem={id,contactId:"22222222-2222-4222-8222-222222222222",customerName:"SYNTHETIC",mode:"in_person",subject:"SYNTHETIC",state:"confirmed",startAt:"2026-11-05T11:00:00Z",endAt:"2026-11-05T11:45:00Z",address:"SYNTHETIC",remotePreference:null,travelBefore:0,travelAfter:0,version:3,history:[]};
it("linked agenda event opens semantic appointment cancellation instead of legacy delete/edit",async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const host=document.createElement("div");document.body.append(host);const root=createRoot(host);
 try {
  await act(async()=>root.render(React.createElement(AgendaPage,{month:"2026-11",today:"2026-11-05",initialDate:"2026-11-05",initialView:"agenda",tasks:[],calendars:[],feedUrl:null,events:[{id:"event",title:"SYNTHETIC",date:"2026-11-05",endDate:"2026-11-05",lastDate:"2026-11-05",start:"08:00",end:"08:45",allDay:false,color:"#22c55e",calendarName:"Órbita",editable:false,location:"SYNTHETIC",description:null,appointmentId:id}]})));
  const open=[...host.querySelectorAll("button")].find(b=>b.textContent?.includes("SYNTHETIC"))!;
  await act(async()=>open.click());
  const link=[...host.querySelectorAll("a")].find(a=>a.textContent?.includes("Cancelar agendamento"));
  expect(link?.getAttribute("href")).toBe(`/agenda/agendamentos?id=${id}`);
  expect(host.textContent).not.toContain("calendário assinado");
  expect([...host.querySelectorAll("button")].some(b=>b.textContent?.includes("Excluir"))).toBe(false);
  expect(host.querySelector('input[value="SYNTHETIC"]')).toBeNull();
 }finally{await act(async()=>root.unmount());host.remove();}
});
it("confirmed presencial explains human details and cancels only its versioned appointment once, retaining failure feedback",async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const host=document.createElement("div");document.body.append(host);const root=createRoot(host);
 let release!:(r:Response)=>void;const fetcher=vi.fn<(url:string,options:RequestInit)=>Promise<Response>>(()=>new Promise(r=>{release=r;}));vi.stubGlobal("fetch",fetcher);
 try {
  await act(async()=>root.render(React.createElement(AppointmentReview,{items:[item],crmBase:null})));
  expect(host.textContent).toContain("Confirmado na agenda");expect(host.textContent).toContain("Antonio confirma os detalhes pessoalmente com o cliente");
  expect(host.textContent).not.toContain("Deslocamento aprovado");
  expect(host.querySelectorAll('input[type="number"]')).toHaveLength(0);
  const cancel=[...host.querySelectorAll("button")].find(b=>b.textContent==="Cancelar agendamento")!;
  await act(async()=>{cancel.click();cancel.click();});
  expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0][0]).toBe("/api/appointments/owner");
  expect(JSON.parse(String(fetcher.mock.calls[0][1].body))).toEqual({id,version:3,operation:"cancel"});expect(cancel.disabled).toBe(true);
  await act(async()=>release(new Response(JSON.stringify({ok:false,error:"version_conflict"}),{status:409})));
  expect(host.textContent).toContain("version_conflict");expect(host.textContent).toContain("SYNTHETIC");
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
