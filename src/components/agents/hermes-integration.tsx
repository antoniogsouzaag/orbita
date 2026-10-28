"use client";
import * as React from "react";
import { HermesWork } from "./hermes-work";
import { HermesMaintenance } from "./hermes-maintenance";
import { verifiedMaintenance, verifiedTask } from "@/lib/director-requests";
import { toast } from "sonner";
import { sendHermes, checkHermes } from "@/app/actions/hermes";
import type { HermesOperation, hermesConfiguration } from "@/server/hermes";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MessageSquare, Send } from "lucide-react";
import { Textarea } from "@/components/ui/input";
export function HermesIntegration({ config, initial, history: controlledHistory, onHistoryChange, hideHistory = false, variant = "card" }: { config: ReturnType<typeof hermesConfiguration>; initial: HermesOperation[]; history?: HermesOperation[]; onHistoryChange?: React.Dispatch<React.SetStateAction<HermesOperation[]>>; hideHistory?: boolean; /** "action": só o botão e o diálogo, para usar dentro de outro card. */ variant?: "card" | "action" }) {
 const [recipient, setRecipient] = React.useState<"Hermes Oracle" | null>(null);
 const [localHistory, setLocalHistory] = React.useState(initial);
 const history = controlledHistory ?? localHistory;
 const setHistory = onHistoryChange ?? setLocalHistory;
 const [pending, start] = React.useTransition();
 const [text, setText] = React.useState("");
 const ready = config.enabled && config.endpointConfigured && config.secretConfigured;
 const [stoppedPolls,setStoppedPolls] = React.useState<string[]>([]);
 const pollCounts = React.useRef(new Map<string, number>());
 React.useEffect(() => {
  if (!ready) return;
  const active = history.filter(item => ["task.dispatch", "agent.analyze", "maintenance.execute"].includes(item.action) && ["accepted", "running"].includes(item.status) && (pollCounts.current.get(item.id) ?? 0) < 12);
  if (!active.length) return;
  let cancelled = false;
  const timer = setTimeout(async () => {
   const updates = await Promise.all(active.map(async item => {
    pollCounts.current.set(item.id, (pollCounts.current.get(item.id) ?? 0) + 1);
    try { return await checkHermes(item.id); }
    catch { pollCounts.current.set(item.id, 12); return null; }
   }));
   if (!cancelled) setStoppedPolls([...pollCounts.current].filter(([,count])=>count>=12).map(([id])=>id));
   if (!cancelled) setHistory(old => old.map(item => updates.find(update => update?.id === item.id) ?? item));
  }, 5000);
  return () => { cancelled = true; clearTimeout(timer); };
 }, [history, ready, setHistory]);
 const busy = React.useRef(false);
 function run(work: () => Promise<HermesOperation>) {
  if (!ready || busy.current) return;
  busy.current = true;
  start(async () => {
   try { const item = await work(); setHistory(old => [item, ...old.filter(row => row.id !== item.id)].slice(0,30)); toast(item.status === "accepted" ? "Recebido pelo Hermes Oracle. Acompanhe o resultado no histórico." : item.detail); }
   catch { toast.error("Não foi possível enviar ou consultar o receptor. Confira o histórico antes de reenviar."); }
   finally { busy.current = false; }
  });
 }
 const work = <HermesWork ready={ready && config.taskDispatchEnabled} onOperation={item=>setHistory(old=>[item,...old.filter(row=>row.id!==item.id)].slice(0,30))} />;
 const maintenance = <HermesMaintenance ready={ready} onOperation={item=>setHistory(old=>[item,...old.filter(row=>row.id!==item.id)].slice(0,30))} />;
 const dialog = ( <Dialog open={recipient !== null} onOpenChange={open => { if (!open && !pending) setRecipient(null); }}><DialogContent title="Acionar Hermes" description="Análise real, acionada manualmente por você.">
 {<div className="space-y-4"><p className="text-xs text-muted">{ready ? "Análise disponível para acionamento manual." : "Receptor pendente de configuração em Integrações. O envio permanece indisponível."}</p> <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => sendHermes({ action:"agent.analyze", params:{ text: text.trim() } })); }}><Textarea aria-label="Pedido de análise para Hermes Oracle" required maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva o contexto e o pedido para Hermes Oracle…" /><Button disabled={!ready || pending || !text.trim()}><Send />Acionar análise</Button></form>
<p className="text-xs text-muted">Somente análise, sem mudanças em produção ou clientes. Lembretes ficam na Órbita; nenhum lembrete paralelo é criado. Recebido não significa concluído.</p><Button size="sm" disabled={!ready || pending} onClick={() => run(() => sendHermes({ action:"diagnostics.read", params:{} }))}>Consultar receptor</Button></div>}
 </DialogContent></Dialog>);
 if (variant === "action") return <>{work}<Button variant="ghost" size="sm" onClick={() => { setRecipient("Hermes Oracle"); setText(""); }}><MessageSquare />Acionar Hermes</Button>{maintenance}{dialog}</>;
 return <Card className="space-y-5 p-5 sm:p-6"><div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-accent/10 text-lg font-semibold text-accent">O</span><div><h2 className="font-semibold">Hermes Oracle</h2><p className="mt-1 text-xs text-muted">Diretor · Hermes · VPS-03</p></div></div><p className="text-xs leading-relaxed text-muted">Encaminhe trabalho autorizado ao Hermes Oracle na VPS03 e acompanhe o recibo de execução e a tarefa. O recibo não é verificação independente dos efeitos.</p>{work}<Button variant="ghost" size="sm" onClick={() => { setRecipient("Hermes Oracle"); setText(""); }}><MessageSquare />Acionar Hermes</Button>
 {maintenance}{dialog}
 {!hideHistory && <details className="rounded-2xl border border-border bg-surface px-5"><summary className="cursor-pointer py-4 text-sm font-medium">Histórico de envios ao Hermes Oracle <span className="ml-2 text-xs text-muted">{history.length} operações</span></summary> <div className="divide-y divide-border">{history.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="text-xs font-medium">{item.action} · {["task.dispatch", "maintenance.execute"].includes(item.action) && item.status === "completed" && !(verifiedTask(item) || verifiedMaintenance(item)) ? "Conclusão não verificada" : item.status}</p>{item.maintenanceOperation && <p className="text-xs">{item.maintenanceOperation} {item.domain} · tarefa {item.taskId}</p>}{item.text && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.text}</p>}<p className="mt-1 text-xs text-muted">{item.detail}</p>{["accepted","running"].includes(item.status) && stoppedPolls.includes(item.id) && <p className="text-xs text-muted">Limite de consultas automáticas atingido ou consulta interrompida. Consulte o mesmo pedido manualmente; não reenvie.</p>}{(item.agentExecution || verifiedMaintenance(item) || verifiedTask(item)) && item.responseText && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{item.responseText}</p>}<p className="mt-1 break-all text-[10px] text-faint">{item.id} · {new Date(item.checkedAt).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</p></div><Button size="sm" disabled={!ready || pending} onClick={() => run(() => checkHermes(item.id))}>Consultar resultado</Button></div>)}</div>
 </details>}</Card>;
}
