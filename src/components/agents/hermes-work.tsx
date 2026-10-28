"use client";
import * as React from "react";
import { executeWork } from "@/app/actions/hermes";
import type { WorkInput } from "@/server/hermes-work";
import type { HermesOperation } from "@/server/hermes";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
const storageKey = "hermes-work-request";
export function HermesWork({ ready, onOperation }: { ready: boolean; onOperation: (item: HermesOperation) => void }) {
 const [open, setOpen] = React.useState(false);
 const [title, setTitle] = React.useState("");
 const [brief, setBrief] = React.useState("");
 const [acceptance, setAcceptance] = React.useState("");
 const [taskId, setTaskId] = React.useState("");
 const [pending, start] = React.useTransition();
 const busy = React.useRef(false);
 const snapshot = React.useRef<WorkInput | null>(null);
 const [submitted, setSubmitted] = React.useState(false);
 const [id, setId] = React.useState("");
 function show() {
  try {
   const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
   if (saved && typeof saved.brief === "string" && typeof saved.acceptance === "string" && (typeof saved.task_id === "string" || typeof saved.title === "string")) {
    snapshot.current = saved; setSubmitted(true); setTitle(saved.title ?? ""); setTaskId(saved.task_id ?? ""); setBrief(saved.brief); setAcceptance(saved.acceptance);
   }
  } catch { /* Keep the snapshot in memory if storage is unavailable. */ }
  setOpen(true);
 }
 function submit() {
  if (!ready || busy.current) return;
  if (!snapshot.current) {
   if (!brief.trim() || !acceptance.trim() || (!taskId && !title.trim())) return;
   snapshot.current = { ...(taskId ? { task_id: taskId } : { title: title.trim() }), brief: brief.trim(), acceptance: acceptance.trim() };
   try { sessionStorage.setItem(storageKey, JSON.stringify(snapshot.current)); } catch { /* Retained in memory. */ }
   setSubmitted(true);
  }
  busy.current = true;
  const input = snapshot.current;
  start(async () => {
   try { const item = await executeWork(input); setId(item.id); onOperation(item); toast(item.detail); }
   catch { toast.error("Pedido incerto ou recusado. Consulte o mesmo trabalho; não crie outro pedido."); }
   finally { busy.current = false; }
  });
 }
 return <><Button size="sm" onClick={show}>Encaminhar trabalho</Button><Dialog open={open} onOpenChange={value => { if (!pending) setOpen(value); }}><DialogContent title="Encaminhar trabalho" description="Investigação, desenvolvimento e correção autorizados · Hermes Oracle · VPS03.">
 <p className="text-xs text-muted">Texto livre é contexto, não shell direto. Perfil, modelo, ferramentas e destino são fixos no executor. Criar tarefa não aprova negócio, despesa ou destruição. A tarefa e o escopo autorizado são a autoridade; sem herdar memória desta conversa.</p>
 <form aria-label="Encaminhar trabalho" className="space-y-3" onSubmit={event => { event.preventDefault(); submit(); }}>
 <fieldset disabled={pending || submitted} className="space-y-3">
 <label className="block">Tarefa empresarial existente (opcional, UUID v4)<Input aria-label="Tarefa do trabalho" value={taskId} onChange={e => setTaskId(e.target.value)} pattern="[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}" /></label>
 {!taskId && <label className="block">Título para criar tarefa<Input aria-label="Título do trabalho" required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} /></label>}
 <label className="block">Brief<Textarea aria-label="Brief do trabalho" required maxLength={12000} value={brief} onChange={e => setBrief(e.target.value)} /></label>
 <label className="block">Critério de aceite<Textarea aria-label="Critério de aceite" required maxLength={4000} value={acceptance} onChange={e => setAcceptance(e.target.value)} /></label>
 </fieldset>
 <Button disabled={!ready || pending}>{submitted ? "Consultar mesmo trabalho" : "Confirmar encaminhamento"}</Button>
 {submitted && <><p className="text-xs text-muted">{id && `Pedido ${id}. `}Retry idêntico recupera a reserva, nunca reenvia. Antes de outro trabalho, confira o histórico.</p><Button type="button" variant="ghost" disabled={pending} onClick={() => { snapshot.current = null; setSubmitted(false); setId(""); setTitle(""); setBrief(""); setAcceptance(""); setTaskId(""); try { sessionStorage.removeItem(storageKey); } catch { /* Memory reset remains usable. */ } }}>Iniciar outro trabalho explicitamente</Button></>}
 </form>
 </DialogContent></Dialog></>;
}
