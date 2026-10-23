"use client";

import { CalendarDays, Goal as GoalIcon, Minus, Pencil, Plus, Trophy } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { deleteGoal, saveGoal } from "@/app/actions/core";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { ColorPicker } from "@/components/ui/color";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/misc";
import { AREAS, type Goal, type TaskScope } from "@/db/schema";
import { projectScope } from "@/lib/task-scope";
import { daysBetween, today } from "@/lib/dates";
import { AREA_LABEL, cn, formatBRL, formatNumber } from "@/lib/utils";

function fmt(g: Goal, v: number) {
  if (g.metric === "currency") return formatBRL(v);
  if (g.metric === "percent") return `${formatNumber(v)}%`;
  return `${formatNumber(v, 2)}${g.unit ? ` ${g.unit}` : ""}`;
}

export function GoalsPage({ goals, scope }: { goals: Goal[]; scope: TaskScope }) {
  const [editing, setEditing] = React.useState<Goal | null>(null);
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const visible = goals;
  function changeProgress(g: Goal, current: number) {
    start(async () => {
      try {
        const completed = Number(g.target) > 0 && current >= Number(g.target);
        await saveGoal(g.id, { title: g.title, current, ...(completed ? { status: "concluida" } : {}) });
        if (completed) toast.success("Meta concluída! 🏆");
      } catch {
        toast.error("Não foi possível atualizar a meta. Tente novamente.");
      }
    });
  }
  const groups = [
    { id: "ativa", label: "Ativas" },
    { id: "pausada", label: "Pausadas" },
    { id: "concluida", label: "Concluídas" },
  ];
  const t = today();
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filtrar metas por espaço" className="flex flex-wrap gap-1">
          {(["pessoal", "empresa"] as const).map((value) => (
            <Button key={value} asChild size="sm" variant={scope === value ? "secondary" : "ghost"}>
              <Link href={value === "empresa" ? "/metas?escopo=empresa" : "/metas"} aria-current={scope === value ? "page" : undefined}>{value === "empresa" ? "Empresa" : "Pessoal"}{scope === value ? ` · ${goals.length}` : ""}</Link>
            </Button>
          ))}
        </div>
        <Button variant="primary" size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus /> Nova meta</Button>
      </div>
      {visible.length === 0 && <Card><EmptyState icon={<Trophy />} title="Nenhuma meta neste espaço" description="Crie uma meta com um alvo mensurável e acompanhe seu progresso." /></Card>}
      {groups.map((grp) => {
        const list = visible.filter((g) => g.status === grp.id);
        if (!list.length) return null;
        return (
          <div key={grp.id} className="mb-8">
            <div className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-faint">{grp.label}</div>
            <div className="grid gap-4 md:grid-cols-2">
              {list.map((g) => {
                const pct = g.target ? Math.max(0, Math.min(100, (Number(g.current) / Number(g.target)) * 100)) : 0;
                const step = g.metric === "currency" ? Math.max(50, Math.round(Number(g.target) / 20)) : g.metric === "percent" ? 5 : 1;
                const days = g.dueDate ? daysBetween(t, g.dueDate) : null;
                return (
                  <Card key={g.id} className={cn("p-5", g.status === "concluida" && "opacity-70")}>
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl text-lg" style={{ background: `color-mix(in oklab, ${g.color} 18%, transparent)` }}>{g.emoji || <GoalIcon className="size-5" style={{ color: g.color }} />}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{g.title}</div>
                        <div className="text-[12px] text-faint">{AREA_LABEL[g.area]}{days !== null && ` · ${days >= 0 ? `faltam ${days} dias` : `venceu há ${-days} dias`}`}</div>
                      </div>
                      <button onClick={() => { setEditing(g); setOpen(true); }} className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-fg" aria-label="Editar"><Pencil className="size-4" /></button>
                    </div>
                    {g.description && <p className="mt-3 text-[13px] text-muted">{g.description}</p>}
                    <div className="mt-4 flex items-end justify-between">
                      <div className="text-[13px]"><span className="text-lg font-semibold tabular-nums">{fmt(g, Number(g.current))}</span> <span className="text-muted">de {fmt(g, Number(g.target))}</span></div>
                      <span className="text-[13px] font-semibold tabular-nums" style={{ color: g.color }}>{Math.round(pct)}%</span>
                    </div>
                    <Progress value={pct} color={g.color} className="mt-2 h-2" />
                    {g.status === "ativa" && (
                      <div className="mt-3 flex items-center gap-2">
                        <Button size="icon-sm" variant="secondary" disabled={pending || Number(g.current) <= 0} onClick={() => changeProgress(g, Math.max(0, Number(g.current) - step))} aria-label={`Diminuir progresso de ${g.title}`}><Minus /></Button>
                        <Button size="icon-sm" variant="secondary" disabled={pending} onClick={() => changeProgress(g, Number(g.current) + step)} aria-label={`Aumentar progresso de ${g.title}`}><Plus /></Button>
                        <span className="text-[11.5px] text-faint">passo de {fmt(g, step)}</span>
                        {g.dueDate && <span className="ml-auto flex items-center gap-1 text-[12px] text-muted"><CalendarDays className="size-3.5" />{g.dueDate.split("-").reverse().join("/")}</span>}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
      {open && <GoalDialog open={open} onOpenChange={setOpen} goal={editing} defaultArea={scope} />}
    </>
  );
}

function GoalDialog({ open, onOpenChange, goal, defaultArea }: { open: boolean; onOpenChange: (v: boolean) => void; goal: Goal | null; defaultArea: Goal["area"] }) {
  const blank = { title: "", emoji: "", description: "", area: defaultArea, metric: "percent", current: "0", target: "100", unit: "", dueDate: "", status: "ativa", color: "#a78bfa" };
  const [f, setF] = React.useState(() => goal ? { title: goal.title, emoji: goal.emoji ?? "", description: goal.description ?? "", area: goal.area, metric: goal.metric, current: String(goal.current), target: String(goal.target), unit: goal.unit ?? "", dueDate: goal.dueDate ?? "", status: goal.status, color: goal.color } : blank);
  const [pending, start] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={goal ? "Editar meta" : "Nova meta"}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              try {
              await saveGoal(goal?.id ?? null, {
                title: f.title, emoji: f.emoji || null, description: f.description || null, area: f.area, metric: f.metric as "percent", current: Number(f.current.replace(",", ".")) || 0,
                target: Number(f.target.replace(",", ".")) || 0, unit: f.unit || null, dueDate: f.dueDate || null, status: f.status as "ativa", color: f.color,
              });
              toast.success("Meta salva");
              onOpenChange(false);
              } catch {
                toast.error("Não foi possível salvar a meta. Revise os campos e tente novamente.");
              }
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-[72px_1fr] gap-2">
            <Field label="Emoji"><Input value={f.emoji} onChange={(e) => setF({ ...f, emoji: e.target.value })} placeholder="🚀" className="text-center" /></Field>
            <Field label="Meta"><Input autoFocus required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Fazer a AG LABS gerar renda recorrente" /></Field>
          </div>
          <Field label="Descrição"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="min-h-16" placeholder="Atingir R$ 3.000/mês recorrentes" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Área"><Select value={f.area} onChange={(e) => setF({ ...f, area: e.target.value as Goal["area"] })}>{AREAS.filter((a) => projectScope(a) === projectScope(defaultArea)).map((a) => <option key={a} value={a}>{AREA_LABEL[a]}</option>)}</Select></Field>
            <Field label="Medida"><Select value={f.metric} onChange={(e) => setF({ ...f, metric: e.target.value, ...(e.target.value === "percent" ? { target: "100" } : {}) })}><option value="percent">Percentual</option><option value="currency">Dinheiro (R$)</option><option value="number">Número</option></Select></Field>
            <Field label="Atual"><Input inputMode="decimal" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></Field>
            <Field label="Alvo"><Input inputMode="decimal" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></Field>
            {f.metric === "number" && <Field label="Unidade"><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="kg, clientes…" /></Field>}
            <Field label="Prazo"><Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></Field>
            <Field label="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="ativa">Ativa</option><option value="pausada">Pausada</option><option value="concluida">Concluída</option></Select></Field>
          </div>
          <Field label="Cor"><ColorPicker value={f.color} onChange={(color) => setF({ ...f, color })} /></Field>
          <div className="flex gap-2">
            {goal && <Button type="button" variant="danger" disabled={pending} onClick={() => start(async () => { if (!confirm("Excluir a meta?")) return; try { await deleteGoal(goal.id); onOpenChange(false); } catch { toast.error("Não foi possível excluir a meta. Tente novamente."); } })}>Excluir</Button>}
            <Button variant="primary" className="ml-auto" disabled={pending}>Salvar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
