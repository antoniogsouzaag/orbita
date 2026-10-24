"use client";
import * as React from "react";
import { toast } from "sonner";
import { sendHermes, checkHermes } from "@/app/actions/hermes";
import type { HermesOperation, hermesConfiguration } from "@/server/hermes";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MessageSquare, Send } from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
export function HermesIntegration({ config, initial, history: controlledHistory, onHistoryChange, hideHistory = false }: { config: ReturnType<typeof hermesConfiguration>; initial: HermesOperation[]; history?: HermesOperation[]; onHistoryChange?: React.Dispatch<React.SetStateAction<HermesOperation[]>>; hideHistory?: boolean }) {
 const [recipient, setRecipient] = React.useState<"Oracle" | null>(null);
 const [localHistory, setLocalHistory] = React.useState(initial);
 const history = controlledHistory ?? localHistory;
 const setHistory = onHistoryChange ?? setLocalHistory;
 const [pending, start] = React.useTransition();
 const [text, setText] = React.useState("");
 const [due, setDue] = React.useState("");
 const ready = config.enabled && config.endpointConfigured && config.secretConfigured;
 function run(work: () => Promise<HermesOperation>) { start(async () => { try { const item = await work(); setHistory(old => [item, ...old.filter((row) => row.id !== item.id)].slice(0,30)); toast(item.status === "accepted" ? "Recebido pelo Oracle. Consulte o resultado no histórico." : item.detail); } catch { toast.error("Não foi possível consultar o receptor. Confira a conexão."); } }); }
 return <Card className="space-y-5 p-5 sm:p-6"><div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-accent/10 text-lg font-semibold text-accent">O</span><div><h2 className="font-semibold">Oracle · Hermes</h2><p className="mt-1 text-xs text-muted">Agente diretor · VPS-03</p></div></div><p className="text-xs leading-relaxed text-muted">Pedidos na caixa interna do Hermes Oracle, com consulta manual do resultado.</p><Button size="sm" onClick={() => { setRecipient("Oracle"); setText(""); }}><MessageSquare />Mensagem</Button>
 <Dialog open={recipient !== null} onOpenChange={open => { if (!open && !pending) setRecipient(null); }}><DialogContent title={`Mensagem para ${recipient ?? "agente"}`} description="Você decide quando enviar cada pedido.">
 {<div className="space-y-4"><p className="text-xs text-muted">{ready ? "Caixa interna disponível para envio manual." : "Receptor pendente de configuração em Integrações. O envio permanece indisponível."}</p> <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => sendHermes({ action:"reminder.internal", params:{ text, due_at: Math.floor(new Date(due).getTime()/1000) } })); }}><Textarea aria-label="Mensagem para Oracle" required maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva o contexto e o pedido para Oracle…" /><label className="block text-xs text-muted">Prazo do pedido<Input className="mt-2" aria-label="Prazo do lembrete no fuso deste dispositivo" type="datetime-local" required value={due} onChange={(e) => setDue(e.target.value)} /></label><Button disabled={!ready || pending}><Send />Enviar à caixa interna</Button></form>
<p className="text-xs text-muted">Escolha o prazo do pedido no fuso deste dispositivo. A caixa interna não agenda a execução do agente. Recebido não significa concluído.</p><Button size="sm" disabled={!ready || pending} onClick={() => run(() => sendHermes({ action:"diagnostics.read", params:{} }))}>Consultar receptor</Button></div>}
 </DialogContent></Dialog>
 {!hideHistory && <details className="rounded-2xl border border-border bg-surface px-5"><summary className="cursor-pointer py-4 text-sm font-medium">Histórico de envios ao Oracle <span className="ml-2 text-xs text-muted">{history.length} operações</span></summary> <div className="divide-y divide-border">{history.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="text-xs font-medium">{item.action} · {item.status}</p><p className="mt-1 text-xs text-muted">{item.detail}</p><p className="mt-1 break-all text-[10px] text-faint">{item.id} · {new Date(item.checkedAt).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</p></div><Button size="sm" disabled={!ready || pending} onClick={() => run(() => checkHermes(item.id))}>Consultar resultado</Button></div>)}</div>
 </details>}</Card>;
}
