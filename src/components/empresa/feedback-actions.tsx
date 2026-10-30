"use client";

import { CheckCheck, ListPlus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { feedbackToTask, updateFeedbackStatus } from "@/app/actions/feedback";
import { Button } from "@/components/ui/button";
import { FEEDBACK_STATUSES, type FeedbackItem, type FeedbackStatus } from "@/lib/crm-feedback";

const ACTION_LABEL: Record<FeedbackStatus, string> = { novo: "Voltar para novo", lido: "Marcar lido", resolvido: "Resolvido", arquivado: "Arquivar" };

export function FeedbackActions({ item }: { item: FeedbackItem }) {
  const router = useRouter();
  const [busy, start] = React.useTransition();
  const run = (fn: () => Promise<unknown>, done: string) => start(async () => {
    try { await fn(); toast.success(done); router.refresh(); } catch { toast.error("O CRM não confirmou a alteração. Tente de novo."); }
  });
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => start(async () => {
        try {
          const id = await feedbackToTask(item);
          toast.success("Tarefa criada", { action: { label: "Abrir", onClick: () => router.push(`/tarefas?escopo=empresa&task=${id}`) } });
          router.refresh();
        } catch { toast.error("Não foi possível criar a tarefa."); }
      })}>
        {busy ? <Loader2 className="animate-spin" /> : <ListPlus />} Virar tarefa
      </Button>
      {FEEDBACK_STATUSES.filter((s) => s !== item.status).map((s) => (
        <Button key={s} size="sm" variant="ghost" disabled={busy} onClick={() => run(() => updateFeedbackStatus(item.id, s), "Feedback atualizado")}>
          {s === "resolvido" && <CheckCheck />} {ACTION_LABEL[s]}
        </Button>
      ))}
    </div>
  );
}
