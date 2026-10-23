"use client";

import { CalendarPlus, CheckSquare, Dumbbell, FolderPlus, Mic, NotebookPen, Plus, Sparkles, Timer, Wallet, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { quickAddTask } from "@/app/actions/core";
import { relativeDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { id: "tarefa", label: "Nova tarefa", icon: CheckSquare, left: 238, top: 238 },
  { id: "nota", label: "Nova nota", icon: NotebookPen, left: 153, top: 218 },
  { id: "evento", label: "Novo compromisso", icon: CalendarPlus, left: 238, top: 150 },
  { id: "gasto", label: "Lançar gasto", icon: Wallet, left: 68, top: 192 },
  { id: "projeto", label: "Novo projeto", icon: FolderPlus, left: 153, top: 126 },
  { id: "treino", label: "Registrar treino", icon: Dumbbell, left: 238, top: 62 },
  { id: "foco", label: "Iniciar foco", icon: Timer, left: 68, top: 104 },
  { id: "ia", label: "Perguntar à IA", icon: Sparkles, left: 153, top: 34 },
  { id: "voz", label: "Ditar tarefa", icon: Mic, left: 24, top: 20 },
] as const;

/** Botão "+" que abre os atalhos de criação rápida (com rótulo no hover) e a captura por voz. */
export function SpeedDial({ onQuickAdd, onOpenChange, scope, open }: { open: boolean; onQuickAdd: (tab: string) => void; onOpenChange: (open: boolean) => void; scope: "pessoal" | "empresa" }) {
  const router = useRouter();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = React.useState({ left: 12, bottom: 90 });
  const changeOpen = (value: boolean) => {
    if (value && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setAnchor({ left: Math.max(12, Math.min(rect.right - 300, window.innerWidth - 312)), bottom: window.innerHeight - rect.top + 16 });
    }
    onOpenChange(value);
    if (!value) triggerRef.current?.focus();
  };
  const [listening, setListening] = React.useState(false);
  const [heard, setHeard] = React.useState("");
  const recRef = React.useRef<{ stop: () => void } | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { onOpenChange(false); triggerRef.current?.focus(); } };
    const closeOnResize = () => { onOpenChange(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", closeOnResize);
    const frame = requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus());
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("resize", closeOnResize); cancelAnimationFrame(frame); };
  }, [open, onOpenChange]);

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
      try {
      const { parsed } = await quickAddTask(spoken, null, scope);
      toast.success(`Tarefa criada: ${parsed.title}${parsed.dueDate ? ` · ${relativeDay(parsed.dueDate)}${parsed.dueTime ? ` ${parsed.dueTime}` : ""}` : ""}`);
      router.refresh();
      } catch { toast.error("Não foi possível salvar o ditado. Tente novamente."); }
    };
    recRef.current = rec;
    changeOpen(false);
    setListening(true);
    try { rec.start(); } catch { setListening(false); toast.error("Não foi possível iniciar o microfone."); }
  };

  function runAction(id: typeof ACTIONS[number]["id"]) {
    if (id === "voz") return voice();
    if (id === "gasto") return onQuickAdd("financas");
    if (["tarefa", "nota", "evento"].includes(id)) return onQuickAdd(id);
    const routes = { projeto: "/projetos?novo=1", treino: "/academia?novo=1", foco: "/foco", ia: "/ia" };
    router.push(routes[id as keyof typeof routes]);
  }


  return (
    <>
      {open && createPortal(
        <>
          <button type="button" aria-label="Fechar menu de atalhos" className="speed-dial-backdrop fixed inset-0 z-50 cursor-default bg-black/45 backdrop-blur-[6px]" onClick={() => changeOpen(false)} />
          <div ref={menuRef} role="menu" aria-label="Captura e atalhos" className="speed-dial-orbit fixed z-[61] h-[294px] w-[300px]" style={anchor} onKeyDown={(event) => {
            const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')];
            const index = buttons.indexOf(event.target as HTMLButtonElement);
            const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : ["ArrowRight", "ArrowDown"].includes(event.key) ? (index + 1) % buttons.length : ["ArrowLeft", "ArrowUp"].includes(event.key) ? (index + buttons.length - 1) % buttons.length : -1;
            if (next >= 0) { event.preventDefault(); buttons[next]?.focus(); }
          }}>
            {ACTIONS.map((action) => {
              return <button key={action.id} type="button" role="menuitem" aria-label={action.label} onClick={() => { changeOpen(false); runAction(action.id); }} style={{ left: action.left, top: action.top }} className="speed-dial-bubble group absolute grid size-[52px] place-items-center rounded-full border border-white/15 bg-[#29292e]/95 text-white/85 shadow-[0_8px_30px_#0005,inset_0_1px_0_#ffffff12] outline-none transition-[background,color,box-shadow,scale] duration-150 hover:scale-110 hover:bg-white hover:text-zinc-950 focus-visible:scale-110 focus-visible:bg-white focus-visible:text-zinc-950 focus-visible:ring-4 focus-visible:ring-white/15">
                <action.icon className="size-[21px]" />
                <span role="tooltip" className="pointer-events-none absolute bottom-full right-0 mb-3 whitespace-nowrap rounded-xl bg-white px-3 py-2 text-[13px] font-semibold text-zinc-950 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{action.label}</span>
              </button>;
            })}
          </div>
        </>, document.getElementById("shell-overlays") ?? document.body,
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
        ref={triggerRef}
        onClick={() => changeOpen(!open)}
        className={cn("relative z-50 grid size-11 place-items-center rounded-full bg-fg text-bg shadow-soft transition hover:scale-105 active:scale-95", open && "rotate-90")}
        aria-label={open ? "Fechar atalhos" : "Atalhos de criação"}
        aria-expanded={open}
      >
        {open ? <X className="size-5" /> : <Plus className="size-5" />}
      </button>
    </>
  );
}
