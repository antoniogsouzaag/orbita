"use client";

import { Dumbbell, Plus, Trash2, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { deleteWorkout, saveWorkout } from "@/app/actions/life";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import type { Workout, WorkoutExercise } from "@/db/schema";
import { relativeDay, today } from "@/lib/dates";

export function WorkoutsPage({ workouts, weekCount, monthCount }: { workouts: Workout[]; weekCount: number; monthCount: number }) {
  const [open, setOpen] = React.useState(false);
  const [base, setBase] = React.useState<Workout | null>(null);
  const [, start] = React.useTransition();
  const params = useSearchParams();
  React.useEffect(() => {
    if (params.get("novo") === "1") setOpen(true);
  }, [params]);
  const templates = [...new Map(workouts.map((w) => [w.name, w])).values()].slice(0, 6);
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4"><div className="text-2xl font-bold tabular-nums">{weekCount}</div><div className="text-[12px] text-muted">treinos nesta semana</div></Card>
        <Card className="p-4"><div className="text-2xl font-bold tabular-nums">{monthCount}</div><div className="text-[12px] text-muted">nos últimos 30 dias</div></Card>
        <div className="col-span-2 flex items-center justify-end gap-2">
          <Button variant="primary" onClick={() => { setBase(null); setOpen(true); }}><Plus /> Registrar treino</Button>
        </div>
      </div>
      {templates.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <span className="self-center text-[12px] text-faint">Repetir:</span>
          {templates.map((t) => <button key={t.id} onClick={() => { setBase(t); setOpen(true); }} className="rounded-full border border-border bg-surface-2 px-3 py-1 text-[12.5px] hover:border-accent/50">{t.name}</button>)}
        </div>
      )}
      {workouts.length === 0 ? (
        <Card><EmptyState icon={<Dumbbell />} title="Nenhum treino registrado" description="Registre treinos com exercícios, séries e cargas." /></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {workouts.map((w) => (
            <Card key={w.id} className="group p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-rose-500/15 text-rose-400"><Dumbbell className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{w.name}</div>
                  <div className="text-[12px] text-faint">{relativeDay(w.date)}{w.minutes ? ` · ${w.minutes} min` : ""}</div>
                </div>
                <button onClick={() => start(async () => { if (confirm("Excluir treino?")) await deleteWorkout(w.id); })} className="rounded p-1 text-faint opacity-0 hover:text-danger group-hover:opacity-100" aria-label="Excluir"><Trash2 className="size-3.5" /></button>
              </div>
              {w.exercises.length > 0 && (
                <div className="mt-3 space-y-1 text-[12.5px]">
                  {w.exercises.map((e, i) => <div key={i} className="flex justify-between gap-2"><span className="truncate">{e.name}</span><span className="shrink-0 tabular-nums text-muted">{[e.sets && `${e.sets}x`, e.reps, e.load].filter(Boolean).join(" ")}</span></div>)}
                </div>
              )}
              {w.notes && <p className="mt-2 text-[12px] text-faint">{w.notes}</p>}
            </Card>
          ))}
        </div>
      )}
      <WorkoutDialog open={open} onOpenChange={setOpen} base={base} />
    </>
  );
}

function WorkoutDialog({ open, onOpenChange, base }: { open: boolean; onOpenChange: (v: boolean) => void; base: Workout | null }) {
  const [name, setName] = React.useState("");
  const [date, setDate] = React.useState(today());
  const [minutes, setMinutes] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [ex, setEx] = React.useState<WorkoutExercise[]>([]);
  const [pending, start] = React.useTransition();
  React.useEffect(() => {
    if (!open) return;
    setName(base?.name ?? "");
    setDate(today());
    setMinutes(base?.minutes ? String(base.minutes) : "");
    setNotes("");
    setEx(base?.exercises.map((e) => ({ ...e })) ?? [{ name: "", sets: 3, reps: "12", load: "" }]);
  }, [open, base]);
  const upd = (i: number, patch: Partial<WorkoutExercise>) => setEx((l) => l.map((e, k) => (k === i ? { ...e, ...patch } : e)));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Registrar treino" wide>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              await saveWorkout(null, { name, date, minutes: minutes ? Number(minutes) : null, notes: notes || null, exercises: ex.filter((x) => x.name.trim()).map((x) => ({ ...x, sets: x.sets ? Number(x.sets) : undefined })) });
              toast.success("Treino registrado 💪");
              onOpenChange(false);
            });
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-[1fr_150px_100px] gap-2">
            <Field label="Treino"><Input required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Treino A · Peito, ombros e tríceps" /></Field>
            <Field label="Data"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Minutos"><Input inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="60" /></Field>
          </div>
          <div className="space-y-1.5">
            <div className="grid grid-cols-[1fr_64px_80px_90px_28px] gap-1.5 px-1 text-[11px] text-faint"><span>Exercício</span><span>Séries</span><span>Reps</span><span>Carga</span><span /></div>
            {ex.map((e, i) => (
              <div key={i} className="grid grid-cols-[1fr_64px_80px_90px_28px] gap-1.5">
                <Input value={e.name} onChange={(v) => upd(i, { name: v.target.value })} placeholder="Supino reto" className="h-9" />
                <Input inputMode="numeric" value={e.sets ?? ""} onChange={(v) => upd(i, { sets: Number(v.target.value) || undefined })} className="h-9" />
                <Input value={e.reps ?? ""} onChange={(v) => upd(i, { reps: v.target.value })} className="h-9" />
                <Input value={e.load ?? ""} onChange={(v) => upd(i, { load: v.target.value })} placeholder="40kg" className="h-9" />
                <button type="button" onClick={() => setEx((l) => l.filter((_, k) => k !== i))} className="grid place-items-center text-faint hover:text-danger" aria-label="Remover"><X className="size-4" /></button>
              </div>
            ))}
            <Button type="button" size="sm" variant="ghost" onClick={() => setEx((l) => [...l, { name: "", sets: 3, reps: "12", load: "" }])}><Plus /> Exercício</Button>
          </div>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações" className="min-h-14" />
          <div className="flex justify-end"><Button variant="primary" disabled={pending}>Salvar treino</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
