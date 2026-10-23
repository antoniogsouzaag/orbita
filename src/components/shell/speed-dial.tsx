"use client";

import { CalendarPlus, CheckSquare, Dumbbell, FolderPlus, Mic, NotebookPen, Plus, Sparkles, Timer, Wallet, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { quickAddTask } from "@/app/actions/core";
import { relativeDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Action = { id: string; label: string; icon: React.ComponentType<{ className?: string }>; run: () => void };

/** Botão "+" que abre os atalhos de criação rápida (com rótulo no hover) e a captura por voz. */
export function SpeedDial({ onQuickAdd }: { onQuickAdd: (tab: string) => void }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [heard, setHeard] = React.useState("");
  const recRef = React.useRef<{ stop: () => void } | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const voice = () => {
    type Rec = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void; onend: () => void; onerror: (e: { error: string }) => void };
    const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const SR = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!SR) return void toast.error("Seu navegador não suporta ditado por voz.");
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText = text;
      }
      setHeard(text);
    };
    rec.onerror = (e) => {
      setListening(false);
      if (e.error !== "no-speech" && e.error !== "aborted") toast.error(e.error === "not-allowed" ? "Permita o microfone para ditar." : "Não consegui ouvir.");
    };
    rec.onend = async () => {
      setListening(false);
      const text = (finalText || "").trim();
      setHeard("");
      if (!text) return;
      // "nota ..." vira nota; o resto vira tarefa interpretada (hoje, amanhã, 15h, prioridade alta...)
      const spoken = text.replace(/\bprioridade (alta|m[ée]dia|baixa)\b/i, (_, p: string) => `!${p.normalize("NFD").replace(/[̀-ͯ]/g, "")}`).replace(/\bhashtag (\S+)/gi, "#$1");
      const { parsed } = await quickAddTask(spoken);
      toast.success(`Tarefa criada: ${parsed.title}${parsed.dueDate ? ` · ${relativeDay(parsed.dueDate)}${parsed.dueTime ? ` ${parsed.dueTime}` : ""}` : ""}`);
      router.refresh();
    };
    recRef.current = rec;
    setOpen(false);
    setListening(true);
    rec.start();
  };

  const actions: Action[] = [
    { id: "tarefa", label: "Nova tarefa", icon: CheckSquare, run: () => onQuickAdd("tarefa") },
    { id: "nota", label: "Nova nota", icon: NotebookPen, run: () => onQuickAdd("nota") },
    { id: "evento", label: "Novo compromisso", icon: CalendarPlus, run: () => onQuickAdd("evento") },
    { id: "gasto", label: "Lançar gasto", icon: Wallet, run: () => onQuickAdd("financas") },
    { id: "projeto", label: "Novo projeto", icon: FolderPlus, run: () => router.push("/projetos?novo=1") },
    { id: "treino", label: "Registrar treino", icon: Dumbbell, run: () => router.push("/academia?novo=1") },
    { id: "foco", label: "Iniciar foco", icon: Timer, run: () => router.push("/foco") },
    { id: "ia", label: "Perguntar à IA", icon: Sparkles, run: () => router.push("/ia") },
    { id: "voz", label: "Ditar tarefa", icon: Mic, run: voice },
  ];

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in" onClick={() => setOpen(false)} />}
      {open && (
        <div className="fixed bottom-24 left-1/2 z-50 w-[min(92vw,360px)] -translate-x-1/2 animate-in">
          <div className="grid grid-cols-3 gap-2">
            {actions.map((a, i) => (
              <button
                key={a.id}
                onClick={() => {
                  setOpen(false);
                  a.run();
                }}
                style={{ animationDelay: `${i * 18}ms` }}
                className="group flex flex-col items-center gap-1.5 rounded-2xl border border-border-strong bg-surface/95 px-2 py-3 text-[12px] text-muted shadow-soft backdrop-blur transition animate-in hover:-translate-y-0.5 hover:text-fg"
              >
                <span className={cn("grid size-10 place-items-center rounded-full bg-surface-2 transition group-hover:bg-accent group-hover:text-accent-fg", a.id === "voz" && "bg-accent/15 text-accent")}>
                  <a.icon className="size-[18px]" />
                </span>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {listening && (
        <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <button onClick={() => recRef.current?.stop()} className="glass flex max-w-md items-center gap-3 rounded-2xl border border-accent/40 px-4 py-3 text-left shadow-soft">
            <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-fg"><Mic className="size-4" /><span className="absolute inset-0 animate-ping rounded-full bg-accent/40" /></span>
            <span className="min-w-0 text-[13px]"><span className="block font-medium">Ouvindo…</span><span className="block truncate text-muted">{heard || "Ex.: “pagar boleto amanhã às 15h prioridade alta”"}</span></span>
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn("relative z-50 grid size-11 place-items-center rounded-full bg-fg text-bg shadow-soft transition hover:scale-105 active:scale-95", open && "rotate-90")}
        aria-label={open ? "Fechar atalhos" : "Atalhos de criação"}
        aria-expanded={open}
      >
        {open ? <X className="size-5" /> : <Plus className="size-5" />}
      </button>
    </>
  );
}
