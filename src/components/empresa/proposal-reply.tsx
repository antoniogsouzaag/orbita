"use client";
import { useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { respondToProposal } from "@/app/actions/proposals";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import type { ProposalSource } from "@/lib/proposals";

export function ProposalReply({ source, agents, defaultAgent }: { source: ProposalSource; agents: { id: string; name: string }[]; defaultAgent?: string }) {
  const router = useRouter();
  const request = useRef<{ id: string; payload: string } | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = JSON.stringify({ source, message: data.get("message"), agent: data.get("agent") });
    if (request.current?.payload !== payload) request.current = { id: crypto.randomUUID(), payload };
    const requestId = request.current.id;
    setError(null); setSaved(null);
    start(async () => {
      try {
        const result = await respondToProposal({ source, requestId, message: data.get("message"), agent: data.get("agent") });
        if (!result.ok) { setError(result.error); return; }
        request.current = null; form.reset(); setSaved(result.id);
        router.push(`/propostas?fila=agentes&task=${result.id}&respondida=1#resposta`);
        router.refresh();
      } catch { setError("Não foi possível confirmar o salvamento. Seu texto foi mantido; tente novamente."); }
    });
  }
  return <form onSubmit={submit} className="space-y-3 border-t border-border pt-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Sua resposta</h3><label className="flex items-center gap-2 text-xs text-muted">Continuar com<Select name="agent" aria-label="Agente responsável pela continuidade" defaultValue={defaultAgent && agents.some(a => a.id === defaultAgent) ? defaultAgent : agents.find(a => a.id === "tom")?.id ?? agents[0]?.id} required disabled={pending || !agents.length} className="h-8 w-auto max-w-48 text-[13px]">{agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</Select></label></div>
    <label htmlFor="proposal-message" className="sr-only">Mensagem para o agente</label>
    <Textarea id="proposal-message" name="message" required minLength={2} maxLength={4000} rows={5} disabled={pending || !agents.length} placeholder="Deixe sua decisão, orientação ou pergunta para o agente continuar…" className="resize-y" />
    {!agents.length && <p role="status" className="text-xs text-warning">Nenhum agente com acesso ativo a tarefas está disponível. Confira os acessos em Integrações.</p>}
    {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    {saved && <p role="status" className="text-xs text-success">Resposta salva. <Link className="underline" href={`/tarefas?escopo=empresa&task=${saved}`}>Acompanhar a tarefa de continuidade</Link>.</p>}
    <div className="flex flex-wrap items-center gap-3"><Button type="submit" variant="primary" size="sm" disabled={pending || !agents.length}>{pending ? "Salvando…" : "Salvar resposta e deixar na fila"}</Button><p className="text-[11px] text-muted">O agente consulta o retorno pela tarefa na Órbita. Execução e conclusão ficam para a próxima etapa.</p></div>
  </form>;
}
