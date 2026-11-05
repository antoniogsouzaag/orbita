"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
export type ReviewItem = {
 id:string; contactId:string; customerName:string|null; state:"confirmed"|"pending_approval"|"cancelled"|"rejected"; mode:"remote"|"in_person";
 subject:string; startAt:string; endAt:string; address:string|null; remotePreference:string|null; travelBefore:number; travelAfter:number; version:number;
 history:{version:number;actor:string;operation:string;createdAt:string}[];
};
const states={confirmed:"Confirmado",pending_approval:"Presencial não confirmado — exige ação",cancelled:"Cancelado",rejected:"Rejeitado"};
export function AppointmentReview({items,crmBase}:{items:ReviewItem[];crmBase:string|null}) {
 return <div className="space-y-3">{items.length===0 && <p>Nenhum agendamento.</p>}{items.map(a=><ReviewCard key={`${a.id}:${a.version}`} item={a} crmBase={crmBase}/>)}</div>;
}
function ReviewCard({item:a,crmBase}:{item:ReviewItem;crmBase:string|null}) {
 const router=useRouter(); const [before,setBefore]=React.useState("");const [after,setAfter]=React.useState("");
 const [pending,setPending]=React.useState(false);const [feedback,setFeedback]=React.useState("");const busy=React.useRef(false);
 async function review(operation:"approve"|"reject"|"cancel") {
  if(busy.current) return;
  if(operation==="approve" && (before===""||after==="")) {setFeedback("Informe explicitamente os dois deslocamentos, inclusive zero.");return;}
  busy.current=true;setPending(true);setFeedback("");
  try {
   const response=await fetch("/api/appointments/owner",{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",redirect:"error",body:JSON.stringify({id:a.id,version:a.version,operation,...(operation==="approve"?{travel_before:Number(before),travel_after:Number(after)}:{})})});
   const result=await response.json();
   if(!response.ok || !result.ok) {setFeedback(`${result.error??"unavailable"} — atualize antes de tentar novamente.`);return;}
   setFeedback("Revisão registrada. Nenhuma mensagem externa enviada.");router.refresh();
  }catch {setFeedback("Resposta incerta. Atualize para conferir o estado; não repita sem verificar.");}
  finally {busy.current=false;setPending(false);}
 }
 const active=a.state==="confirmed"||a.state==="pending_approval";
 return <Card className="space-y-3 p-5">
  <h2 className="font-semibold">{a.subject}</h2><p>{states[a.state]} · versão {a.version}</p>
  <p>{new Date(a.startAt).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})} · Brasília · 45 minutos + 15 de folga</p>
  <p>{a.customerName??"Cliente"} · {a.mode==="remote"?"Remoto":"Presencial"}</p>
  <p className="break-all">CRM: {crmBase?<a href={crmBase} target="_blank" rel="noreferrer" className="text-accent underline">{a.contactId}</a>:a.contactId}</p>
  {a.mode==="remote"?<p>Preferência: {a.remotePreference??"Não informada"}. Antonio prepara e envia o link manualmente antes do atendimento.</p>:<><p>Endereço: {a.address}</p><p>Deslocamento aprovado: {a.travelBefore} min antes / {a.travelAfter} min depois.</p></>}
  {a.state==="pending_approval" && <><p>Horário não reservado. Confira disponibilidade e defina deslocamento para aprovar; ou rejeite e peça outra opção.</p><div className="flex flex-wrap gap-3">
   <label>Deslocamento antes (min)<input className="block rounded border p-2" type="number" min="0" max="600" required value={before} onChange={e=>setBefore(e.target.value)} disabled={pending}/></label>
   <label>Deslocamento depois (min)<input className="block rounded border p-2" type="number" min="0" max="600" required value={after} onChange={e=>setAfter(e.target.value)} disabled={pending}/></label>
  </div><Button disabled={pending} onClick={()=>review("approve")}>Aprovar presencial</Button> <Button disabled={pending} variant="outline" onClick={()=>review("reject")}>Rejeitar e pedir alternativa</Button></>}
  {active && <Button disabled={pending} variant="danger" onClick={()=>review("cancel")}>Cancelar agendamento</Button>}
  <p role="status">{pending?"Registrando revisão…":feedback}</p>
  <details><summary>Histórico de revisão</summary><ul>{a.history.map(h=><li key={h.version}>v{h.version} · {h.actor} · {h.operation} · {new Date(h.createdAt).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</li>)}</ul></details>
 </Card>;
}
