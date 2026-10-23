"use client";
import { ArrowRight, Loader2, Target, Timer } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { suggestNextActionAction } from "@/app/actions/decisions";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { PriorityTask } from "@/lib/priorities";
import type { NextActionDecision } from "@/server/decisions";

export function Priorities({ tasks, jev }: { tasks: PriorityTask[]; jev: boolean }) {
  const [decision, setDecision] = React.useState<NextActionDecision | null>(null);
  const [pending, start] = React.useTransition();
  const chosen = tasks.find((task) => task.id === decision?.taskId);
  const visible = chosen ? [chosen, ...tasks.filter((task) => task.id !== chosen.id)].slice(0, 3) : tasks.slice(0, 3);
  return <Card className="mb-5">
    <CardHeader icon={<Target />} title="Próxima ação" href="/tarefas" hrefLabel="Organizar tarefas" />
    <div className="space-y-3 px-5 pb-5">
      <p className="text-xs text-muted">Até três tarefas para reduzir a dispersão. Ordem por prazo e prioridade; os registros originais continuam sob seu controle.</p>
      {!visible.length ? <Link href="/tarefas" className="inline-flex items-center gap-2 text-sm text-accent">Capture sua primeira tarefa <ArrowRight className="size-4" /></Link> : <ul className="divide-y divide-border">{visible.map((task, index) => <li key={task.id} className="flex items-center gap-3 py-3"><span className="text-xs tabular-nums text-faint">0{index + 1}</span><Link href={`/tarefas?task=${task.id}`} className="min-w-0 flex-1 text-sm hover:text-accent"><span className="block truncate">{task.title}</span><span className="mt-1 block text-[11px] text-faint">{task.dueDate ? `Prazo ${task.dueDate.split("-").reverse().join("/")}` : "Sem prazo"}{task.priority >= 3 ? " · prioridade alta" : ""}</span></Link><Button asChild size="sm" variant="ghost"><Link href={`/foco?tarefa=${task.id}`}><Timer /> Focar</Link></Button></li>)}</ul>}
      {tasks.length > 1 && <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3"><Button size="sm" variant="outline" disabled={!jev || pending} onClick={() => start(async () => {
        try { setDecision(await suggestNextActionAction()); }
        catch { setDecision({ taskId: null, source: "rules", confidence: null, message: "Não foi possível consultar agora. A ordem por prazo e prioridade foi preservada." }); }
      })}>{pending ? <Loader2 className="animate-spin" /> : <Target />} Sugerir com Jev</Button><p className="flex-1 text-[11px] text-faint">{jev ? "Opcional: envia título, prazo e prioridade de até 20 tarefas ao Jev da TypeSafe via OpenRouter. Nenhuma ação é executada." : "A ordem atual funciona sem IA. Ative o OpenRouter em Integrações para sugestões opcionais."}</p></div>}
      {decision && <p aria-live="polite" className="text-xs text-muted">{decision.message}{decision.confidence !== null ? ` Confiança declarada pelo modelo: ${Math.round(decision.confidence * 100)}%.` : ""}</p>}
    </div>
  </Card>;
}
