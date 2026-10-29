"use client";
import * as React from "react";
import { executeWork } from "@/app/actions/hermes";
import type { WorkInput } from "@/server/hermes-work";
import type { HermesOperation } from "@/server/hermes";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
const storageKey = "hermes-work-request";
export function HermesWork({ ready, onOperation }: { ready: boolean; onOperation: (item: HermesOperation) => void }) {
 const [open, setOpen] = React.useState(false);
 const [brief, setBrief] = React.useState("");
 const [pending, start] = React.useTransition();
 const busy = React.useRef(false);
 const snapshot = React.useRef<WorkInput | null>(null);
 const [submitted, setSubmitted] = React.useState(false);
 const [id, setId] = React.useState("");
 function show() {
  try {
   const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
   if (saved && typeof saved.brief === "string" && typeof saved.acceptance === "string" && (typeof saved.task_id === "string" || typeof saved.title === "string")) {
    snapshot.current = saved; setSubmitted(true); setBrief(saved.brief);
   }
  } catch { /* Keep the snapshot in memory if storage is unavailable. */ }
  setOpen(true);
 }
 function submit() {
  if (!ready || busy.current) return;
  if (!snapshot.current) {
   if (!brief.trim()) return;
   const message = brief.trim();
   snapshot.current = { title: message.replace(/\s+/g, " ").slice(0, 200), brief: message, acceptance: "Atender ao pedido dentro do escopo autorizado, verificar o resultado e registrar evidências e eventuais pendências na tarefa." };
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
 return <><Button size="sm" disabled={!ready} onClick={show}>Mensagem</Button><Dialog open={open} onOpenChange={value => { if (!pending) setOpen(value); }}><DialogContent title="Mensagem para Hermes Oracle" description="Envie um pedido ao diretor do VPS-03 e acompanhe o resultado no histórico.">
 <p className="text-xs text-muted">O pedido cria uma tarefa para o Hermes. Descreva o objetivo e o resultado esperado. Criar a tarefa não autoriza despesas, decisões de negócio ou ações destrutivas.</p>
 <form aria-label="Encaminhar trabalho" className="space-y-3" onSubmit={event => { event.preventDefault(); submit(); }}>
 <fieldset disabled={pending || submitted} className="space-y-3">
 <label className="block">Mensagem<Textarea aria-label="Mensagem para Hermes Oracle" required maxLength={12000} value={brief} onChange={e => setBrief(e.target.value)} placeholder="O que o Hermes deve fazer e como verificar o resultado?" /></label>
 </fieldset>
 <Button disabled={!ready || pending}>{submitted ? "Consultar mesmo pedido" : "Enviar mensagem"}</Button>
 {submitted && <><p className="text-xs text-muted">{id && `Pedido ${id}. `}Consultar recupera a reserva sem reenviar. Antes de outro pedido, confira o histórico.</p><Button type="button" variant="ghost" disabled={pending} onClick={() => { snapshot.current = null; setSubmitted(false); setId(""); setBrief(""); try { sessionStorage.removeItem(storageKey); } catch { /* Memory reset remains usable. */ } }}>Iniciar outra mensagem</Button></>}
 </form>
 </DialogContent></Dialog></>;
}
