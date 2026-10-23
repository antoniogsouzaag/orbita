"use client";

import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { logFocus } from "@/app/actions/life";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { focusedMinutes } from "@/lib/focus";

type Phase = "foco" | "pausa";
const KEY = "orbita:focus";

type Props = { tasks: { id: string; title: string }[]; defaultMinutes: number; initialTaskId?: string };
const subscribeHydration = () => () => {};
export function FocusTimer(props: Props) {
  const ready = React.useSyncExternalStore(subscribeHydration, () => true, () => false);
  return ready ? <FocusTimerClient {...props} /> : <Card className="p-8 text-sm text-muted">Preparando seu bloco de foco…</Card>;
}

function FocusTimerClient({ tasks, defaultMinutes, initialTaskId }: Props) {
  const [initial] = React.useState(() => {
    const fallback = { phase: "foco" as Phase, minutes: defaultMinutes, taskId: initialTaskId ?? "", endsAt: null as number | null, remaining: defaultMinutes * 60, sessionId: null as string | null };
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (!saved || !["foco", "pausa"].includes(saved.phase) || !Number.isInteger(saved.minutes) || saved.minutes < 1 || saved.minutes > 600) return fallback;
      if (saved.endsAt && (!Number.isFinite(saved.endsAt) || saved.endsAt < Date.now() - 86_400_000)) return fallback;
      const seconds = (saved.phase === "foco" ? saved.minutes : saved.minutes >= 50 ? 10 : 5) * 60;
      return { phase: saved.phase as Phase, minutes: saved.minutes as number, taskId: tasks.some((task) => task.id === saved.taskId) ? saved.taskId as string : initialTaskId ?? "", endsAt: typeof saved.endsAt === "number" ? saved.endsAt : null, remaining: saved.endsAt ? Math.max(0, Math.round((saved.endsAt - Date.now()) / 1000)) : Math.max(0, Math.min(seconds, Number.isFinite(saved.remaining) ? saved.remaining : seconds)), sessionId: typeof saved.sessionId === "string" && /^[0-9a-f-]{36}$/.test(saved.sessionId) ? saved.sessionId : saved.endsAt ? crypto.randomUUID() : null };
    } catch { return fallback; }
  });
  const [minutes, setMinutes] = React.useState(initial.minutes);
  const [phase, setPhase] = React.useState<Phase>(initial.phase);
  const [endsAt, setEndsAt] = React.useState<number | null>(initial.endsAt);
  const [remaining, setRemaining] = React.useState(initial.remaining);
  const [taskId, setTaskId] = React.useState(initial.taskId);
  const sessionRef = React.useRef<string | null>(initial.sessionId);
  const completed = React.useRef(new Set<string>());
  const [, start] = React.useTransition();
  const total = (phase === "foco" ? minutes : minutes >= 50 ? 10 : 5) * 60;

  function persist(state: object | null) {
    try { if (state) localStorage.setItem(KEY, JSON.stringify(state)); else localStorage.removeItem(KEY); } catch {}
  }
  function finish(automatic = false) {
    const sessionId = sessionRef.current;
    if (phase === "foco" && sessionId && completed.current.has(sessionId)) return;
    if (sessionId) completed.current.add(sessionId);
    setEndsAt(null);
    sessionRef.current = null;
    if (phase === "foco") {
      const recorded = focusedMinutes(minutes, remaining, automatic);
      if (recorded > 0 && sessionId) {
        const label = tasks.find((task) => task.id === taskId)?.title ?? null;
        const end = new Date(automatic && endsAt ? endsAt : Date.now()).toISOString();
        start(async () => {
          try {
            const result = await logFocus(recorded, label, taskId || null, sessionId, end);
            if (result.recorded) toast.success(`+${recorded} min de foco registrados`);
          } catch { toast.error("O tempo de foco não foi salvo. Confira sua conexão."); }
        });
      }
      setPhase("pausa");
      setRemaining((minutes >= 50 ? 10 : 5) * 60);
    } else { setPhase("foco"); setRemaining(minutes * 60); }
    persist(null);
    if (automatic) {
      try {
        const audio = new AudioContext();
        const oscillator = audio.createOscillator(); const gain = audio.createGain();
        oscillator.frequency.value = phase === "foco" ? 880 : 660;
        gain.gain.setValueAtTime(0.12, audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.3);
        oscillator.connect(gain).connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + 0.3);
        oscillator.onended = () => { void audio.close(); };
        if ("Notification" in window && Notification.permission === "granted") new Notification(phase === "foco" ? "Foco concluído! Hora da pausa." : "Pausa encerrada. Bora voltar?");
      } catch {}
    }
  }
  const finishFromClock = React.useEffectEvent(() => finish(true));
  React.useEffect(() => {
    if (!endsAt) return;
    const tick = () => {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setRemaining(left);
      document.title = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")} · ${phase === "foco" ? "Foco" : "Pausa"}`;
      if (left === 0) finishFromClock();
    };
    const first = requestAnimationFrame(tick);
    const timer = setInterval(tick, 500);
    return () => { cancelAnimationFrame(first); clearInterval(timer); };
  }, [endsAt, phase]);
  React.useEffect(() => () => { document.title = "Foco · Órbita"; }, []);

  const startTimer = () => {
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission().catch(() => {});
    const end = Date.now() + remaining * 1000;
    if (!sessionRef.current) sessionRef.current = crypto.randomUUID();
    setEndsAt(end);
    persist({ endsAt: end, remaining, phase, minutes, taskId, sessionId: sessionRef.current });
  };
  const pause = () => {
    const left = endsAt ? Math.max(0, Math.round((endsAt - Date.now()) / 1000)) : remaining;
    setEndsAt(null); setRemaining(left);
    persist({ endsAt: null, remaining: left, phase, minutes, taskId, sessionId: sessionRef.current });
  };
  const reset = () => { setEndsAt(null); setPhase("foco"); setRemaining(minutes * 60); sessionRef.current = null; persist(null); };

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const pct = 1 - remaining / total;
  const R = 120;
  const C = 2 * Math.PI * R;

  return (
    <Card className="flex flex-col items-center gap-6 p-8">
      <Segmented
        value={String(minutes)}
        onChange={(v) => {
          if (endsAt) return;
          setMinutes(Number(v));
          if (phase === "foco") setRemaining(Number(v) * 60);
        }}
        options={[15, 25, 50, 90].map((m) => ({ value: String(m), label: `${m} min` }))}
      />
      <div className="relative grid size-[280px] place-items-center">
        <svg viewBox="0 0 280 280" className="absolute inset-0 -rotate-90">
          <circle cx="140" cy="140" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="10" />
          <circle cx="140" cy="140" r={R} fill="none" stroke={phase === "foco" ? "var(--accent)" : "var(--success)"} strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} className="transition-[stroke-dashoffset] duration-500" />
        </svg>
        <div className="text-center">
          <div className="font-mono text-6xl font-semibold tabular-nums tracking-tight">{mm}:{ss}</div>
          <div className={cn("mt-1 text-[13px] font-medium uppercase tracking-widest", phase === "foco" ? "text-accent" : "text-success")}>{phase === "foco" ? "Foco" : "Pausa"}</div>
        </div>
      </div>
      <Select value={taskId} onChange={(e) => setTaskId(e.target.value)} className="max-w-sm" disabled={Boolean(endsAt)}>
        <option value="">Sem tarefa vinculada</option>
        {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
      </Select>
      <div className="flex items-center gap-3">
        <Button size="icon" variant="secondary" onClick={reset} aria-label="Reiniciar"><RotateCcw /></Button>
        {endsAt ? (
          <Button size="lg" variant="primary" className="w-36" onClick={pause}><Pause /> Pausar</Button>
        ) : (
          <Button size="lg" variant="primary" className="w-36" onClick={startTimer}><Play /> {remaining < total ? "Retomar" : "Começar"}</Button>
        )}
        <Button size="icon" variant="secondary" onClick={() => finish(false)} aria-label="Pular"><SkipForward /></Button>
      </div>
    </Card>
  );
}
