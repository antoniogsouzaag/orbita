"use client";
import * as React from "react";
import { executeMaintenance } from "@/app/actions/hermes";
import type { MaintenanceInput } from "@/server/hermes-maintenance";
import type { HermesOperation } from "@/server/hermes";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";

export function HermesMaintenance({ready,onOperation}:{ready:boolean;onOperation:(item:HermesOperation)=>void}) {
 const [open,setOpen]=React.useState(false);
 const [operation,setOperation]=React.useState<MaintenanceInput["operation"]>("maia.recover");
 const [domain,setDomain]=React.useState("");
 const [taskId,setTaskId]=React.useState("");
 const [create,setCreate]=React.useState(false);
 const [notes,setNotes]=React.useState("");
 const [pending,start]=React.useTransition();
 const busy=React.useRef(false);
 const snapshot=React.useRef<MaintenanceInput | null>(null);
 const [submitted,setSubmitted]=React.useState(false);
 const [requestId,setRequestId]=React.useState("");
 function show() {
  try {
   const saved=sessionStorage.getItem("hermes-maintenance-request");
   if(saved) {
    const input=JSON.parse(saved) as MaintenanceInput;
    if(input.requestId && input.task && ["maia.recover","monitor.domain.ensure"].includes(input.operation)) {
     snapshot.current=input;setSubmitted(true);setRequestId(input.requestId);setOperation(input.operation);setDomain(input.domain ?? "");
     setCreate("create" in input.task);setTaskId("id" in input.task ? input.task.id : "");setNotes("notes" in input.task ? input.task.notes : "");
    }
   }
  }catch{/* Armazenamento indisponível: UUID permanece na memória. */}
  setOpen(true);
 }
 function submit() {
  if(!ready || busy.current) return;
  if(!snapshot.current) {
   if ((!create && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(taskId)) || (create && !notes.trim())) return;
   snapshot.current={requestId:crypto.randomUUID(),operation,...(operation === "monitor.domain.ensure" ? {domain} : {}),task:create?{create:true,notes}:{id:taskId}};
   try{sessionStorage.setItem("hermes-maintenance-request",JSON.stringify(snapshot.current));}catch{/* UUID retido em memória. */}
   setSubmitted(true);setRequestId(snapshot.current.requestId);
  }
  busy.current=true;
  const input=snapshot.current;
  start(async()=>{try{const item=await executeMaintenance(input);onOperation(item);toast(item.detail);}catch{toast.error("Envio incerto ou recusado. Consulte o mesmo pedido; não crie outra tarefa.");}finally{busy.current=false;}});
 }
 return <><Button size="sm" onClick={show}>Executar manutenção</Button><Dialog open={open} onOpenChange={value=>{if(!pending)setOpen(value);}}><DialogContent title="Executar manutenção" description="Correção manual por runbooks determinísticos, sem shell arbitrário.">
 <p className="text-xs text-muted">Autoriza mudanças apenas na operação escolhida. O executor reivindica e encerra a tarefa via MCP; a Órbita não conclui tarefas. Nenhuma automação de incidentes é habilitada.</p>
 <form aria-label="Manutenção operacional" className="space-y-3" onSubmit={event=>{event.preventDefault();submit();}}>
 <fieldset disabled={pending || submitted} className="space-y-3">
 <label className="block">Operação<Select aria-label="Operação de manutenção" value={operation} onChange={e=>setOperation(e.target.value as MaintenanceInput["operation"])}><option value="maia.recover">Recuperar Maia</option><option value="monitor.domain.ensure">Monitorar domínio</option></Select></label>
 {operation === "monitor.domain.ensure" && <label className="block">Domínio registrado<Input aria-label="Domínio registrado" required maxLength={253} value={domain} onChange={e=>setDomain(e.target.value)} placeholder="example.com.br" /></label>}
 <label className="block"><input type="checkbox" checked={create} onChange={e=>setCreate(e.target.checked)} />Criar tarefa empresarial para este pedido</label>
 {create ? <label className="block">Contexto / notas<Textarea aria-label="Contexto da tarefa" required maxLength={4000} value={notes} onChange={e=>setNotes(e.target.value)} /></label> : <label className="block">Tarefa empresarial existente (UUID v4)<Input aria-label="UUID da tarefa empresarial" required value={taskId} onChange={e=>setTaskId(e.target.value)} /></label>}
 </fieldset>
 <Button disabled={!ready || pending}>{submitted ? "Consultar mesmo pedido" : "Confirmar execução"}</Button>
 {submitted && <><p className="text-xs text-muted">Pedido {requestId}. Retry mantém UUID e tarefa; resultado no histórico. Consulte antes de iniciar outro pedido.</p><Button type="button" disabled={pending} onClick={()=>{snapshot.current=null;setSubmitted(false);sessionStorage.removeItem("hermes-maintenance-request");}}>Iniciar novo pedido explicitamente</Button></>}
 </form>
 </DialogContent></Dialog></>;
}
