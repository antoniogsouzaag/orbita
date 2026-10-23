"use client";

import { Flame, Pencil, Plus, Trophy } from "lucide-react";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { deleteHabit, saveHabit, toggleHabit } from "@/app/actions/core";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ColorPicker } from "@/components/ui/color";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { CheckButton, Segmented, Tooltip } from "@/components/ui/misc";
import { AREAS, type Habit } from "@/db/schema";
import { WEEKDAY_SHORT, lastNDays, shiftDate, startOfWeekISO, today } from "@/lib/dates";
import { bestStreak, completionRate, isScheduled } from "@/lib/habits";
import { AREA_LABEL, cn } from "@/lib/utils";
import type { HabitWithStats } from "@/server/habits";

const SUGGESTIONS = [
  { emoji: "💻", name: "Estudar programação", area: "estudos" },
  { emoji: "🇺🇸", name: "Estudar inglês por 20 min", area: "estudos" },
  { emoji: "🏋️", name: "Treino / Musculação", area: "saude", frequency: "weekly", timesPerWeek: 3 },
  { emoji: "😴", name: "Dormir pelo menos 7h", area: "saude" },
  { emoji: "📚", name: "Ler 20 páginas", area: "estudos" },
  { emoji: "💧", name: "Beber a meta diária de água", area: "saude" },
  { emoji: "💰", name: "Revisar minhas finanças", area: "financas", frequency: "weekly", timesPerWeek: 1 },
  { emoji: "🚀", name: "Bloco de foco na AG LABS", area: "empresa" },
] as const;

export function HabitsPage({ habits }: { habits: HabitWithStats[] }) {
  const [editing, setEditing] = React.useState<Habit | null>(null);
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const t = today();

  const addSuggestion = (s: (typeof SUGGESTIONS)[number]) =>
    start(async () => {
      try {
        await saveHabit(null, { name: s.name, emoji: s.emoji, area: s.area, frequency: "frequency" in s ? s.frequency : "daily", timesPerWeek: "timesPerWeek" in s ? s.timesPerWeek : 7 });
        toast.success(`Hábito “${s.name}” criado`);
      } catch { toast.error("Não foi possível criar o hábito."); }
    });

  return (
    <>
      <div className="mb-4 flex justify-end"><Button variant="primary" size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus /> Novo hábito</Button></div>
      {SUGGESTIONS.some((s) => !habits.some((h) => h.name === s.name)) && (
        <Card className="mb-6 p-5">
          <p className="mb-3 text-sm font-medium">Modelos de hábitos</p><p className="mb-4 text-xs text-muted">Adicione uma base e ajuste a meta. Marque os dias em que fez no calendário; as fichas de exercícios ficam em <Link href="/academia" className="text-accent hover:underline">Academia</Link>.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.filter((s) => !habits.some((h) => h.name === s.name)).map((s) => (
              <button disabled={pending} key={s.name} onClick={() => addSuggestion(s)} className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[13px] hover:border-accent/50 disabled:opacity-50">{s.emoji} {s.name}</button>
            ))}
          </div>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {habits.map((h) => {
          const done = new Set(h.logs);
          const best = bestStreak(h, done, t);
          const rate = completionRate(h, done, t);
          const weeks = 18;
          const start0 = shiftDate(startOfWeekISO(t), -(weeks - 1) * 7);
          return (
            <Card key={h.id} className="p-5">
              <div className="flex items-center gap-3">
                <CheckButton shape="square" checked={h.doneToday} color={h.color} label="Marcar hoje" onToggle={() => start(() => toggleHabit(h.id).then(() => undefined))} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{h.emoji} {h.name}</div>
                  <div className="text-[12px] text-faint">
                    {AREA_LABEL[h.area]} · {h.frequency === "weekly" ? `${h.timesPerWeek}x por semana (${h.weekDone} nesta)` : h.weekdays.length ? h.weekdays.map((d) => WEEKDAY_SHORT[d].toLowerCase()).join(", ") : "todos os dias"}
                  </div>
                </div>
                <button onClick={() => { setEditing(h); setOpen(true); }} className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-fg" aria-label="Editar"><Pencil className="size-4" /></button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-surface-2 py-2"><div className="flex items-center justify-center gap-1 text-lg font-semibold tabular-nums"><Flame className="size-4 text-orange-400" />{h.streak.value}</div><div className="text-[11px] text-muted">atual ({h.streak.unit})</div></div>
                <div className="rounded-xl bg-surface-2 py-2"><div className="flex items-center justify-center gap-1 text-lg font-semibold tabular-nums"><Trophy className="size-4 text-amber-300" />{best}</div><div className="text-[11px] text-muted">recorde</div></div>
                <div className="rounded-xl bg-surface-2 py-2"><div className="text-lg font-semibold tabular-nums">{rate}%</div><div className="text-[11px] text-muted">últimos 30 dias</div></div>
              </div>
              <div className="no-scrollbar mt-4 overflow-x-auto">
                <div className="grid w-max grid-flow-col grid-rows-7 gap-[3px]">
                  {Array.from({ length: weeks * 7 }, (_, i) => {
                    const d = shiftDate(start0, i);
                    const future = d > t;
                    const on = done.has(d);
                    const sched = isScheduled(h, d);
                    return (
                      <Tooltip key={d} content={`${d.split("-").reverse().join("/")}${on ? " ✓" : ""}`}>
                        <button
                          disabled={future}
                          onClick={() => start(() => toggleHabit(h.id, d).then(() => undefined))}
                          className={cn("size-3.5 rounded-[4px] transition hover:ring-1 hover:ring-fg/40", future && "opacity-0")}
                          style={{ background: on ? h.color : sched ? "var(--surface-3)" : "color-mix(in oklab, var(--surface-3) 45%, transparent)" }}
                          aria-label={`${d} ${on ? "feito" : "não feito"}`}
                        />
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
              <div className="mt-2 flex gap-1 text-[11px] text-faint">{lastNDays(7, t).map((d) => <span key={d} className="flex-1 text-center">{WEEKDAY_SHORT[new Date(`${d}T12:00:00Z`).getUTCDay()]}</span>)}</div>
            </Card>
          );
        })}
      </div>
      {open && <HabitDialog open={open} onOpenChange={setOpen} habit={editing} />}
    </>
  );
}

function HabitDialog({ open, onOpenChange, habit }: { open: boolean; onOpenChange: (v: boolean) => void; habit: Habit | null }) {
  const blank = { name: "", emoji: "", color: "#22d3ee", area: "pessoal" as Habit["area"], frequency: "daily", timesPerWeek: 3, weekdays: [] as number[] };
  const [f, setF] = React.useState(habit ? { name: habit.name, emoji: habit.emoji ?? "", color: habit.color, area: habit.area, frequency: habit.frequency, timesPerWeek: habit.timesPerWeek, weekdays: habit.weekdays } : blank);
  const [pending, start] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={habit ? "Editar hábito" : "Novo hábito"}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              await saveHabit(habit?.id ?? null, { ...f, emoji: f.emoji || null, frequency: f.frequency as "daily" | "weekly", timesPerWeek: f.frequency === "weekly" ? f.timesPerWeek : 7 });
              toast.success("Hábito salvo");
              onOpenChange(false);
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-[72px_1fr] gap-2">
            <Field label="Emoji"><Input value={f.emoji} onChange={(e) => setF({ ...f, emoji: e.target.value })} placeholder="📚" className="text-center" maxLength={8} /></Field>
            <Field label="Nome"><Input autoFocus required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ler 20 páginas" /></Field>
          </div>
          <Field label="Área">
            <Select value={f.area} onChange={(e) => setF({ ...f, area: e.target.value as Habit["area"] })}>{AREAS.map((a) => <option key={a} value={a}>{AREA_LABEL[a]}</option>)}</Select>
          </Field>
          <Field label="Frequência">
            <Segmented value={f.frequency} onChange={(frequency) => setF({ ...f, frequency })} options={[{ value: "daily", label: "Dias da semana" }, { value: "weekly", label: "Vezes por semana" }]} />
          </Field>
          {f.frequency === "daily" ? (
            <div className="flex gap-1">
              {WEEKDAY_SHORT.map((d, i) => {
                const on = f.weekdays.length === 0 || f.weekdays.includes(i);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      const cur = f.weekdays.length ? f.weekdays : [0, 1, 2, 3, 4, 5, 6];
                      const next = cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort();
                      setF({ ...f, weekdays: next.length === 7 ? [] : next });
                    }}
                    className={cn("h-9 flex-1 rounded-lg text-[11.5px] font-semibold", on ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted")}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          ) : (
            <Field label="Quantas vezes por semana?">
              <Input type="number" min={1} max={7} value={f.timesPerWeek} onChange={(e) => setF({ ...f, timesPerWeek: Number(e.target.value) })} />
            </Field>
          )}
          <Field label="Cor"><ColorPicker value={f.color} onChange={(color) => setF({ ...f, color })} /></Field>
          <div className="flex gap-2">
            {habit && <Button type="button" variant="danger" onClick={() => start(async () => { if (!confirm("Excluir o hábito e todo o histórico?")) return; await deleteHabit(habit.id); onOpenChange(false); })}>Excluir</Button>}
            {habit && <Button type="button" variant="ghost" onClick={() => start(async () => { await saveHabit(habit.id, { name: habit.name, archived: true }); onOpenChange(false); })}>Arquivar</Button>}
            <Button variant="primary" className="ml-auto" disabled={pending}>Salvar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
