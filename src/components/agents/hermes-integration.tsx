"use client";
import * as React from "react";
import { toast } from "sonner";
import { sendHermes, checkHermes } from "@/app/actions/hermes";
import type { HermesOperation, hermesConfiguration } from "@/server/hermes";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
export function HermesIntegration({ config, initial }: { config: ReturnType<typeof hermesConfiguration>; initial: HermesOperation[] }) {
 const [history, setHistory] = React.useState(initial);
 const [pending, start] = React.useTransition();
 const [text, setText] = React.useState("");
 const [due, setDue] = React.useState("");
 const ready = config.enabled && config.endpointConfigured && config.secretConfigured;
 function run(work: () => Promise<HermesOperation>) { start(async () => { try { const item = await work(); setHistory((old) => [item, ...old.filter((row) => row.id !== item.id)].slice(0,30)); } catch { toast.error("Não foi possível consultar o receptor. Confira a conexão."); } }); }
 return <Card className="space-y-4 p-5"><div><h2 className="font-semibold">Hermes Oracle · eventos de saída</h2><p className="mt-2 text-sm text-muted">{ready ? "Despacho habilitado no servidor; a primeira operação confirma a comunicação." : "Saída da Órbita pendente de configuração no servidor. Verifique também a disponibilidade do receptor."}</p></div>
 <div className="flex flex-wrap gap-2 text-xs text-muted"><span>Despacho: {config.enabled ? "habilitado" : "desabilitado"}</span><span>Rota: {config.endpointConfigured ? "configurada" : "pendente"}</span><span>Chave: {config.secretConfigured ? "configurada" : "pendente"}</span></div>
 <Button disabled={!ready || pending} onClick={() => run(() => sendHermes({ action:"diagnostics.read", params:{} }))}>Consultar versão do Hermes</Button>
 <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto]" onSubmit={(e) => { e.preventDefault(); run(() => sendHermes({ action:"reminder.internal", params:{ text, due_at: Math.floor(new Date(due).getTime()/1000) } })); }}><Input aria-label="Lembrete interno" required maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Lembrete interno para o Hermes" /><Input aria-label="Prazo do lembrete no fuso deste dispositivo" type="datetime-local" required value={due} onChange={(e) => setDue(e.target.value)} /><Button disabled={!ready || pending}>Registrar lembrete</Button></form>
 <p className="text-xs text-muted">A caixa interna não envia notificações e não agenda o agente. Recebido não significa concluído. Prazo no fuso deste dispositivo.</p>
 <div className="divide-y divide-border">{history.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="text-xs font-medium">{item.action} · {item.status}</p><p className="mt-1 text-xs text-muted">{item.detail}</p><p className="mt-1 break-all text-[10px] text-faint">{item.id} · {new Date(item.checkedAt).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</p></div><Button size="sm" disabled={!ready || pending} onClick={() => run(() => checkHermes(item.id))}>Consultar resultado</Button></div>)}</div>
 </Card>;
}
