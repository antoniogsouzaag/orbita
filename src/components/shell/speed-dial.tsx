"use client";

import { CalendarPlus, CheckSquare, Dumbbell, FolderPlus, Mic, NotebookPen, Plus, Sparkles, Timer, Wallet, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { quickAddTask } from "@/app/actions/core";
import { relativeDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { orbitPositions, orbitTarget, type OrbitPoint } from "./interactions";
import styles from "./speed-dial.module.css";

const ACTIONS = [
  { id: "tarefa", label: "Nova tarefa", icon: CheckSquare },
  { id: "nota", label: "Nova nota", icon: NotebookPen },
  { id: "evento", label: "Novo compromisso", icon: CalendarPlus },
  { id: "gasto", label: "Lançar gasto", icon: Wallet },
  { id: "projeto", label: "Novo projeto", icon: FolderPlus },
  { id: "treino", label: "Registrar treino", icon: Dumbbell },
  { id: "foco", label: "Iniciar foco", icon: Timer },
  { id: "ia", label: "Perguntar à IA", icon: Sparkles },
  { id: "voz", label: "Ditar tarefa", icon: Mic },
] as const;

/** Tap to browse, or press, drag to a bubble and release to run its action. */
export function SpeedDial({ onQuickAdd, onOpenChange, scope, open }: { open: boolean; onQuickAdd: (tab: string) => void; onOpenChange: (open: boolean) => void; scope: "pessoal" | "empresa" }) {
  const router = useRouter();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const menuId = React.useId();
  const helpId = React.useId();
  const actions = ACTIONS.filter((action) => scope === "pessoal" || ["tarefa", "projeto", "foco", "ia", "voz"].includes(action.id));
  const positions = orbitPositions(actions.length);
  const [anchor, setAnchor] = React.useState({ left: 0, top: 0 });
  const originRef = React.useRef<OrbitPoint>({ x: 0, y: 0 });
  const gestureRef = React.useRef<{ pointerId: number; start: OrbitPoint; wasOpen: boolean; moved: boolean } | null>(null);
  const openedByPointer = React.useRef(false);
  const [selected, setSelected] = React.useState<number | null>(null);
  const changeOpen = React.useCallback((value: boolean) => {
    if (value && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      originRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      setAnchor({ left: originRef.current.x, top: originRef.current.y });
    }
    setSelected(null);
    onOpenChange(value);
    if (!value) triggerRef.current?.focus();
  }, [onOpenChange, setSelected, setAnchor]);
  const [listening, setListening] = React.useState(false);
  const [heard, setHeard] = React.useState("");
  const recRef = React.useRef<{ stop: () => void; onend: () => void } | null>(null);

  React.useEffect(() => () => {
    if (recRef.current) {
      // Leaving this space cancels dictation instead of creating a task afterward.
      recRef.current.onend = () => {};
      recRef.current.stop();
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); changeOpen(false); }
      // Hand off focus cleanly when another shell layer is requested.
      const anotherLayer = ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") || (!e.metaKey && !e.ctrlKey && !e.altKey && !e.isComposing && ["'", "c"].includes(e.key.toLowerCase()));
      if (anotherLayer) changeOpen(false);
      if (e.key === "Tab") {
        const items = [...menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]') ?? [], triggerRef.current].filter((item): item is HTMLButtonElement => !!item);
        const current = items.indexOf(document.activeElement as HTMLButtonElement);
        e.preventDefault();
        items[(current + (e.shiftKey ? -1 : 1) + items.length) % items.length]?.focus();
      }
    };
    const closeOnResize = () => changeOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", closeOnResize);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => { if (!openedByPointer.current) menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus(); });
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("resize", closeOnResize); cancelAnimationFrame(frame); document.body.style.overflow = previousOverflow; };
  }, [open, changeOpen]);

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
      // Voice creates a task in the space where recording began.
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
    const routes = { projeto: `/projetos?novo=1${scope === "empresa" ? "&escopo=empresa" : ""}`, treino: "/academia?novo=1", foco: scope === "empresa" ? "/foco?escopo=empresa" : "/foco", ia: scope === "empresa" ? "/ia?escopo=empresa" : "/ia" };
    router.push(routes[id as keyof typeof routes]);
  }

  const targetAt = (point: OrbitPoint) => orbitTarget({ x: point.x - originRef.current.x, y: point.y - originRef.current.y }, positions);
  const labelFor = (action: typeof ACTIONS[number]) => action.id === "tarefa" ? `Nova tarefa ${scope === "empresa" ? "da empresa" : "pessoal"}` : action.id === "voz" ? `Ditar tarefa ${scope === "empresa" ? "da empresa" : "pessoal"}` : action.label;

  return (
    <>
      {open && createPortal(
        <>
          <button type="button" tabIndex={-1} aria-label="Fechar menu de atalhos" className={styles.backdrop} onClick={() => changeOpen(false)} />
          <div ref={menuRef} id={menuId} data-shell-layer="open" role="menu" aria-label={`Captura e atalhos · ${scope === "empresa" ? "Empresa" : "Pessoal"}`} aria-describedby={helpId} className={styles.orbit} style={anchor} onKeyDown={(event) => {
            const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')];
            const index = buttons.indexOf(event.target as HTMLButtonElement);
            const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : ["ArrowRight", "ArrowDown"].includes(event.key) ? (index + 1) % buttons.length : ["ArrowLeft", "ArrowUp"].includes(event.key) ? (index + buttons.length - 1) % buttons.length : -1;
            if (next >= 0) { event.preventDefault(); buttons[next]?.focus(); }
          }}>
            <svg className={styles.guide} viewBox="0 0 240 240" fill="none" aria-hidden="true">
              <path d="M26 216 A190 190 0 0 1 216 26" stroke="currentColor" strokeOpacity=".18" strokeDasharray="2 7" />
              <path d="M110 216 A106 106 0 0 1 216 110" stroke="currentColor" strokeOpacity=".12" />
            </svg>
            <div className={styles.caption}>
              <strong aria-live="polite">{selected !== null ? labelFor(actions[selected]) : "Seu próximo passo"}</strong>
              <span id={helpId}>{scope === "empresa" ? "Empresa" : "Pessoal"} · toque ou arraste e solte</span>
            </div>
            {actions.map((action, index) => {
              return <button key={action.id} type="button" role="menuitem" aria-label={labelFor(action)} data-selected={selected === index} onFocus={() => setSelected(index)} onPointerEnter={(event) => { if (event.pointerType === "mouse" && !gestureRef.current) setSelected(index); }} onClick={() => { changeOpen(false); runAction(action.id); }} style={{ left: positions[index].x - 25, top: positions[index].y - 25, animationDelay: `${index * 12}ms` }} className={styles.bubble}>
                <action.icon className="size-[21px]" aria-hidden="true" />
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
        type="button"
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          event.preventDefault();
          openedByPointer.current = true;
          gestureRef.current = { pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, wasOpen: open, moved: false };
          event.currentTarget.setPointerCapture(event.pointerId);
          if (!open) changeOpen(true);
        }}
        onPointerMove={(event) => {
          const gesture = gestureRef.current;
          if (!gesture || gesture.pointerId !== event.pointerId) return;
          if (Math.hypot(event.clientX - gesture.start.x, event.clientY - gesture.start.y) >= 10) gesture.moved = true;
          if (gesture.moved) setSelected(targetAt({ x: event.clientX, y: event.clientY }));
        }}
        onPointerUp={(event) => {
          const gesture = gestureRef.current;
          if (!gesture || gesture.pointerId !== event.pointerId) return;
          gestureRef.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          if (gesture.moved) {
            const target = targetAt({ x: event.clientX, y: event.clientY });
            changeOpen(false);
            if (target !== null) runAction(actions[target].id);
          } else if (gesture.wasOpen) changeOpen(false);
          else menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
        }}
        onPointerCancel={() => { gestureRef.current = null; changeOpen(false); }}
        onLostPointerCapture={() => { if (gestureRef.current) { gestureRef.current = null; changeOpen(false); } }}
        onContextMenu={(event) => event.preventDefault()}
        onClick={(event) => { if (event.detail === 0) { openedByPointer.current = false; changeOpen(!open); } }}
        className={cn(styles.trigger, "relative z-50 grid size-11 place-items-center rounded-full bg-fg text-bg shadow-soft transition hover:scale-105 active:scale-95", open && "rotate-90")}
        data-open={open}
        aria-label={open ? "Fechar atalhos" : "Atalhos de criação"}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
      >
        {open ? <X className="size-5" /> : <Plus className="size-5" />}
      </button>
    </>
  );
}
