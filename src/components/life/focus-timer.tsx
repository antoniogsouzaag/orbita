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

type Phase = "foco" | "pausa";
const KEY = "orbita:focus";

export function FocusTimer({ tasks, defaultMinutes }: { tasks: { id: string; title: string }[]; defaultMinutes: number }) {
  const [minutes, setMinutes] = React.useState(defaultMinutes);
  const [phase, setPhase] = React.useState<Phase>("foco");
  const [endsAt, setEndsAt] = React.useState<number | null>(null);
  const [remaining, setRemaining] = React.useState(defaultMinutes * 60);
  const [taskId, setTaskId] = React.useState("");
  const [, start] = React.useTransition();
  const total = (phase === "foco" ? minutes : minutes >= 50 ? 10 : 5) * 60;

  // restaura timer em andamento (sobrevive a recarregar a página)
  React.useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (s?.endsAt > Date.now()) {
        setPhase(s.phase);
        setMinutes(s.minutes);
        setTaskId(s.taskId ?? "");
        setEndsAt(s.endsAt);
      }
    } catch {}
  }, []);

  React.useEffect(() => {
    if (!endsAt) return;
    const tick = () => {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setRemaining(left);
      document.title = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")} · ${phase === "foco" ? "Foco" : "Pausa"}`;
      if (left === 0) finish();
    };
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [endsAt]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => () => void (document.title = "Foco · Órbita"), []);

  const persist = (s: object | null) => {
    try {
      if (s) localStorage.setItem(KEY, JSON.stringify(s));
      else localStorage.removeItem(KEY);
    } catch {}
  };

  const finish = () => {
    setEndsAt(null);
    persist(null);
    try {
      const ctx = new AudioContext();
      [0, 0.25, 0.5].forEach((t) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = phase === "foco" ? 880 : 660;
        g.gain.setValueAtTime(0.18, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + t);
        o.stop(ctx.currentTime + t + 0.22);
      });
      if ("Notification" in window && Notification.permission === "granted") new Notification(phase === "foco" ? "Foco concluído! Hora da pausa." : "Pausa encerrada. Bora voltar?");
    } catch {}
    if (phase === "foco") {
      const label = tasks.find((t) => t.id === taskId)?.title ?? null;
      start(() => logFocus(minutes, label, taskId || null));
      toast.success(`+${minutes} min de foco registrados`);
      setPhase("pausa");
      setRemaining((minutes >= 50 ? 10 : 5) * 60);
    } else {
      setPhase("foco");
      setRemaining(minutes * 60);
    }
  };

  const startTimer = () => {
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    const e = Date.now() + remaining * 1000;
    setEndsAt(e);
    persist({ endsAt: e, phase, minutes, taskId });
  };
  const pause = () => {
    setEndsAt(null);
    persist(null);
  };
  const reset = () => {
    pause();
    setPhase("foco");
    setRemaining(minutes * 60);
  };

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
        <Button size="icon" variant="secondary" onClick={finish} aria-label="Pular"><SkipForward /></Button>
      </div>
    </Card>
  );
}
