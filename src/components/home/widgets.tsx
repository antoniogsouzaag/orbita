"use client";

import {
  ArrowRight, BookOpen, CalendarDays, CheckSquare, ChevronLeft, ChevronRight, Dumbbell, Flame, Goal, Loader2, Repeat, Server, Smile, Sparkles, Timer, Trophy, Wallet, X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { saveCheckin, toggleHabit, toggleTask } from "@/app/actions/core";
import { TaskItem } from "@/components/tasks/task-item";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { CheckButton, Progress, Tooltip } from "@/components/ui/misc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { relativeDay } from "@/lib/dates";
import { cn, formatBRL, formatNumber } from "@/lib/utils";
import type { HomeData, StreakCard } from "@/server/home";

/* ───────── Metas & Conquistas (sequências) ───────── */
export function StreaksWidget({ cards }: { cards: StreakCard[] }) {
  const [i, setI] = React.useState(0);
  const c = cards[i] ?? cards[0];
  if (!c) return null;
  const remaining = c.next - c.streak;
  const pct = Math.round((c.streak / c.next) * 100);
  return (
    <Card className="h-full">
      <CardHeader
        icon={<Flame />}
        title="Metas & Conquistas"
        href={c.href}
        hrefLabel={c.key === "orbita" ? "Revisão" : "Hábitos"}
        actions={
          cards.length > 1 && (
            <div className="mr-2 flex items-center gap-1">
              <button onClick={() => setI((i - 1 + cards.length) % cards.length)} className="rounded-md p-0.5 text-faint hover:text-fg" aria-label="Anterior"><ChevronLeft className="size-4" /></button>
              <button onClick={() => setI((i + 1) % cards.length)} className="rounded-md p-0.5 text-faint hover:text-fg" aria-label="Próximo"><ChevronRight className="size-4" /></button>
              <div className="ml-1 flex items-center gap-1">
                {cards.map((x, k) => (
                  <button key={x.key} onClick={() => setI(k)} className={cn("h-1.5 rounded-full transition-all", k === i ? "w-5" : "w-1.5 bg-border-strong")} style={k === i ? { background: c.color } : undefined} aria-label={x.label} />
                ))}
              </div>
            </div>
          )
        }
      />
      <div className="px-5 pb-5">
        <div className="flex items-center gap-3">
          <div className="relative grid size-12 place-items-center rounded-full text-xl" style={{ background: `color-mix(in oklab, ${c.color} 18%, transparent)` }}>
            {c.emoji}
            {c.week.find((d) => d.isToday)?.done && <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-success text-[9px] text-white">✓</span>}
          </div>
          <div>
            <div className="text-[11.5px] font-bold uppercase tracking-wider" style={{ color: c.color }}>{c.label}</div>
            <div className="flex items-baseline gap-1.5"><span className="text-2xl font-bold tabular-nums">{c.streak}</span><span className="text-[12px] font-semibold uppercase text-muted">{c.streak === 1 ? "dia seguido" : "dias seguidos"}</span></div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1 border-t border-border pt-3">
          {c.week.map((d) => (
            <div key={d.date} className="flex flex-col items-center gap-1.5">
              <span className={cn("text-[10.5px] font-medium", d.isToday ? "font-bold" : "text-faint")} style={d.isToday ? { color: c.color } : undefined}>{d.label}</span>
              <span
                className={cn("grid size-6 place-items-center rounded-full border text-[11px] text-white", d.done ? "border-transparent" : d.future ? "border-border" : "border-border-strong")}
                style={d.done ? { background: c.color } : d.isToday ? { borderColor: c.color } : undefined}
              >
                {d.done ? "✓" : d.isToday ? <span className="size-1.5 rounded-full" style={{ background: c.color }} /> : null}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-surface-2 p-3">
          <div className="mb-2 flex justify-between text-[12px]"><span className="text-muted">Próximo marco: <b className="text-fg">{c.next}</b></span><span className="font-semibold" style={{ color: c.color }}>Faltam {remaining}</span></div>
          <Progress value={pct} color={c.color} />
          <p className="mt-2 text-[11.5px] italic text-faint">“{c.quote}”</p>
        </div>
      </div>
    </Card>
  );
}

/* ───────── Hábitos ───────── */
export function HabitsWidget({ habits, done, total }: { habits: HomeData["habits"]; done: number; total: number }) {
  const [optimistic, setOptimistic] = React.useOptimistic(habits, (state, id: string) => state.map((h) => (h.id === id ? { ...h, doneToday: !h.doneToday } : h)));
  const [, start] = React.useTransition();
  const doneCount = optimistic.filter((h) => h.scheduledToday && h.doneToday).length;
  return (
    <Card className="h-full">
      <CardHeader icon={<Repeat />} title="Hábitos de hoje" meta={`${doneCount}/${total}`} href="/habitos" hrefLabel="Hábitos" />
      {habits.length === 0 ? (
        <EmptyState icon={<Repeat />} title="Nenhum hábito ainda" description="Crie hábitos para acompanhar sequências." action={<Button size="sm" asChild><Link href="/habitos">Criar hábito</Link></Button>} />
      ) : (
        <div className="max-h-[360px] overflow-y-auto px-3 pb-3">
          {optimistic.map((h) => (
            <div key={h.id} className={cn("flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2", !h.scheduledToday && "opacity-50")}>
              <CheckButton
                shape="square"
                checked={h.doneToday}
                color={h.color}
                label={`Marcar ${h.name}`}
                onToggle={() =>
                  start(async () => {
                    setOptimistic(h.id);
                    await toggleHabit(h.id);
                  })
                }
              />
              <span className="min-w-0 flex-1 truncate text-[14px]">{h.emoji && <span className="mr-1.5">{h.emoji}</span>}{h.name}</span>
              <div className="hidden items-center gap-[3px] sm:flex">
                {h.last7.map((d, k) => {
                  const isToday = k === 6;
                  const on = isToday ? h.doneToday : d.done;
                  return <span key={d.date} className={cn("rounded-full", d.scheduled ? "size-[7px]" : "size-[4px]")} style={{ background: on ? h.color : "var(--border-strong)" }} />;
                })}
              </div>
              <Tooltip content={h.frequency === "weekly" ? `${h.weekDone}/${h.timesPerWeek} nesta semana` : "Sequência atual"}>
                <span className="flex w-12 shrink-0 items-center justify-end gap-0.5 text-[12px] tabular-nums text-muted">
                  <Flame className={cn("size-3.5", h.streak.value > 0 && "text-orange-400")} />
                  {h.streak.value}
                  {h.streak.unit === "sem" ? " sem" : ""}
                </span>
              </Tooltip>
            </div>
          ))}
        </div>
      )}
      {total > 0 && <div className="px-5 pb-4"><Progress value={(doneCount / total) * 100} /></div>}
    </Card>
  );
}

/* ───────── Tarefas ───────── */
export function TasksWidget({ tasks, counts }: { tasks: HomeData["tasks"]; counts: HomeData["counts"] }) {
  const router = useRouter();
  const [optimistic, setOptimistic] = React.useOptimistic(tasks, (state, id: string) => state.map((t) => (t.id === id ? { ...t, status: t.status === "done" ? "todo" : "done" } : t)) as typeof tasks);
  const [, start] = React.useTransition();
  return (
    <Card className="h-full">
      <CardHeader icon={<CheckSquare />} title="Tarefas" meta={`${counts.today} para hoje · ${counts.overdue} ${counts.overdue === 1 ? "atrasada" : "atrasadas"}`} href="/tarefas" />
      {tasks.length === 0 ? (
        <EmptyState icon={<CheckSquare />} title="Nada pendente" description="Use a captura rápida acima para adicionar." />
      ) : (
        <div className="px-3 pb-2">
          {optimistic.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              compact
              onOpen={() => router.push(`/tarefas?task=${t.id}`)}
              onToggle={() =>
                start(async () => {
                  setOptimistic(t.id);
                  await toggleTask(t.id);
                  if (t.status !== "done") toast.success("Tarefa concluída ✓");
                })
              }
            />
          ))}
        </div>
      )}
      {counts.open > tasks.length && (
        <Link href="/tarefas" className="flex items-center gap-1 px-5 pb-4 text-[12.5px] text-muted hover:text-fg">Ver as {counts.open} tarefas <ArrowRight className="size-3.5" /></Link>
      )}
    </Card>
  );
}

/* ───────── Agenda ───────── */
export function AgendaWidget({ agenda }: { agenda: HomeData["agenda"] }) {
  return (
    <Card className="h-full">
      <CardHeader icon={<CalendarDays />} title="Agenda" href="/agenda" hrefLabel="Calendário" />
      {agenda.length === 0 ? (
        <EmptyState icon={<CalendarDays />} title="Agenda livre" description="Nenhum compromisso nos próximos dias." />
      ) : (
        <div className="space-y-3 px-5 pb-5">
          {agenda.map((d) => (
            <div key={d.date}>
              <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-faint">{d.label}</div>
              <div className="space-y-2">
                {d.items.map((e) => (
                  <Link key={e.id} href="/agenda" className="flex gap-3 rounded-lg py-0.5 hover:opacity-80">
                    <span className="w-12 shrink-0 pt-0.5 text-right text-[12.5px] tabular-nums text-muted">{e.allDay ? "—" : e.time}</span>
                    <span className="w-[3px] shrink-0 rounded-full" style={{ background: e.color }} />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px]">{e.title}</span>
                      <span className="block text-[12px] text-faint">{e.allDay ? "Dia todo" : e.until}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ───────── Metas ───────── */
export function GoalsWidget({ goals }: { goals: HomeData["goals"] }) {
  return (
    <Card className="h-full">
      <CardHeader icon={<Goal />} title="Metas" href="/metas" hrefLabel="Metas" />
      {goals.length === 0 ? (
        <EmptyState icon={<Trophy />} title="Defina suas metas" description="Metas com progresso mensurável aparecem aqui." action={<Button size="sm" asChild><Link href="/metas">Criar meta</Link></Button>} />
      ) : (
        <div className="space-y-3.5 px-5 pb-5">
          {goals.slice(0, 5).map((g) => {
            const pct = g.target ? Math.round((Number(g.current) / Number(g.target)) * 100) : 0;
            return (
              <Link key={g.id} href="/metas" className="block">
                <div className="flex items-center gap-2 text-[14px]">
                  <span className="size-1.5 shrink-0 rounded-full" style={{ background: g.color }} />
                  <span className="min-w-0 flex-1 truncate">{g.emoji && `${g.emoji} `}{g.title}</span>
                  <span className="text-[12px] tabular-nums text-muted">{Math.max(0, Math.min(100, pct))}%</span>
                </div>
                {g.description && <p className="mt-0.5 truncate pl-3.5 text-[12px] text-faint">{g.description}</p>}
                <Progress value={pct} color={g.color} className="mt-1.5" />
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ───────── Como foi hoje? ───────── */
const MOODS = ["😞", "😕", "😐", "🙂", "😄"];
export function CheckinWidget({ checkin }: { checkin: HomeData["checkin"] }) {
  const [mood, setMood] = React.useState<number | null>(checkin?.mood ?? null);
  const [energy, setEnergy] = React.useState<number | null>(checkin?.energy ?? null);
  const [note, setNote] = React.useState(checkin?.note ?? "");
  const [, start] = React.useTransition();
  const save = (patch: Parameters<typeof saveCheckin>[0]) => start(() => saveCheckin(patch));
  return (
    <Card className="h-full">
      <CardHeader icon={<Smile />} title="Como foi hoje?" href="/revisao" hrefLabel="Revisão" />
      <div className="space-y-3 px-5 pb-5">
        <div className="flex items-center gap-3">
          <span className="w-14 text-[12px] text-muted">Humor</span>
          <div className="flex flex-1 justify-between gap-1">
            {MOODS.map((m, k) => (
              <button key={m} onClick={() => { const v = mood === k + 1 ? null : k + 1; setMood(v); save({ mood: v }); }} className={cn("grid size-9 place-items-center rounded-xl border text-lg transition", mood === k + 1 ? "border-accent bg-accent/15 scale-105" : "border-border bg-surface-2 opacity-70 hover:opacity-100")} aria-label={`Humor ${k + 1}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-14 text-[12px] text-muted">Energia</span>
          <div className="flex flex-1 justify-between gap-1">
            {[1, 2, 3, 4, 5].map((lv) => (
              <button key={lv} onClick={() => { const v = energy === lv ? null : lv; setEnergy(v); save({ energy: v }); }} className={cn("flex h-9 w-9 items-end justify-center gap-[2px] rounded-xl border pb-2 transition", energy === lv ? "border-accent bg-accent/15" : "border-border bg-surface-2 hover:border-border-strong")} aria-label={`Energia ${lv}`}>
                {[1, 2, 3, 4, 5].map((b) => <span key={b} className="w-[3px] rounded-sm" style={{ height: 3 + b * 2.5, background: b <= lv ? "var(--accent)" : "var(--border-strong)" }} />)}
              </button>
            ))}
          </div>
        </div>
        <Input value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (checkin?.note ?? "") && save({ note })} placeholder="Uma linha sobre o dia (opcional)" className="h-9" />
      </div>
    </Card>
  );
}

/* ───────── Plano do dia (IA) ───────── */
export function PlanWidget({ plan, aiEnabled }: { plan: HomeData["plan"]; aiEnabled: boolean }) {
  const router = useRouter();
  const [prompt, setPrompt] = React.useState(plan?.prompt ?? "");
  const [from, setFrom] = React.useState("08");
  const [to, setTo] = React.useState("22");
  const [loading, setLoading] = React.useState(false);
  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, from: Number(from), to: Number(to) }) });
      const json = await res.json();
      if (!res.ok) toast.error(json.error ?? "Falha ao planejar");
      else {
        toast.success("Plano montado");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };
  const nowMin = (() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); })();
  const toMin = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
  return (
    <Card className="h-full">
      <CardHeader icon={<Sparkles />} title="Plano do dia" href="/ia" hrefLabel="IA" />
      <div className="px-5 pb-5">
        {plan && plan.blocks.length > 0 ? (
          <div className="space-y-1.5">
            {plan.summary && <p className="mb-2 text-[13px] text-muted">{plan.summary}</p>}
            {plan.blocks.map((b, k) => {
              const active = nowMin >= toMin(b.start) && nowMin < toMin(b.end);
              return (
                <div key={k} className={cn("flex items-center gap-3 rounded-xl px-3 py-2", active ? "bg-accent/12 ring-1 ring-accent/40" : "bg-surface-2")}>
                  <span className="w-[86px] shrink-0 text-[12px] tabular-nums text-muted">{b.start}–{b.end}</span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">{b.title}</span>
                  <span className="shrink-0 rounded-md bg-surface-3 px-1.5 py-0.5 text-[10.5px] uppercase tracking-wide text-faint">{b.kind}</span>
                </div>
              );
            })}
            <button onClick={generate} disabled={loading || !aiEnabled} className="mt-2 text-[12.5px] text-muted hover:text-fg">{loading ? "Replanejando…" : "↻ Replanejar"}</button>
          </div>
        ) : (
          <>
            <p className="mb-3 text-[13px] text-muted">A IA olha suas tarefas, agenda, hábitos, metas e treino e monta os blocos de hoje.</p>
            <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Algo especial hoje? (opcional)" className="mb-3 h-9" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-muted">Das</span>
              <HourSelect value={from} onChange={setFrom} />
              <span className="text-[12px] text-muted">às</span>
              <HourSelect value={to} onChange={setTo} />
              <Button variant="primary" size="sm" className="ml-auto" onClick={generate} disabled={loading || !aiEnabled}>
                {loading ? <Loader2 className="animate-spin" /> : <Sparkles />} Planejar meu dia
              </Button>
            </div>
            {!aiEnabled && <p className="mt-2 text-[12px] text-faint">Configure a chave da IA em <Link href="/integracoes" className="underline">Integrações</Link>.</p>}
          </>
        )}
      </div>
    </Card>
  );
}

function HourSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-8 rounded-lg border border-border bg-surface-2 px-2 text-[13px] outline-none">
      {Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0")).map((h) => <option key={h} value={h}>{h}h</option>)}
    </select>
  );
}

/* ───────── Operação (status ao vivo) ───────── */
type OpsSummary = { configured: boolean; total: number; up: number; down: { name: string; url: string; group: string }[]; checkedAt: string };
export function OpsWidget() {
  const [data, setData] = React.useState<OpsSummary | null>(null);
  const [err, setErr] = React.useState(false);
  React.useEffect(() => {
    fetch("/api/ops/status?summary=1").then(async (r) => (r.ok ? setData(await r.json()) : setErr(true))).catch(() => setErr(true));
  }, []);
  return (
    <Card className="h-full">
      <CardHeader icon={<Server />} title="Operação" href="/operacao" hrefLabel="Visão geral" />
      <div className="px-5 pb-5">
        {!data && !err && <div className="flex items-center gap-2 py-6 text-[13px] text-muted"><Loader2 className="size-4 animate-spin" /> Verificando endereços…</div>}
        {err && <p className="py-4 text-[13px] text-muted">Não foi possível checar agora.</p>}
        {data && !data.configured && <p className="py-4 text-[13px] text-muted">Conecte o vault para ler a lista de monitoramento.</p>}
        {data && data.configured && (
          <>
            <div className="flex items-end gap-2">
              <span className={cn("text-3xl font-bold tabular-nums", data.down.length ? "text-danger" : "text-success")}>{data.up}/{data.total}</span>
              <span className="pb-1 text-[13px] text-muted">no ar</span>
            </div>
            {data.down.length === 0 ? (
              <p className="mt-2 text-[13px] text-muted">Todos os endereços responderam. ✅</p>
            ) : (
              <div className="mt-3 space-y-1.5">
                {data.down.slice(0, 5).map((d) => (
                  <div key={d.url} className="flex items-center gap-2 text-[13px]"><X className="size-3.5 text-danger" /><span className="truncate">{d.name}</span><span className="ml-auto shrink-0 text-[11px] text-faint">{d.group}</span></div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

/* ───────── Pequenos widgets ───────── */
export function FocusWidget({ focus }: { focus: HomeData["focus"] }) {
  return (
    <Card className="h-full">
      <CardHeader icon={<Timer />} title="Tempo de foco" href="/foco" hrefLabel="Foco" />
      <div className="grid grid-cols-3 gap-2 px-5 pb-5">
        <Stat label="Hoje" value={fmtMin(focus.today)} />
        <Stat label="Esta semana" value={fmtMin(focus.week)} />
        <Stat label="Média diária" value={fmtMin(focus.avgDaily)} />
      </div>
    </Card>
  );
}

export function WorkoutWidget({ workout }: { workout: HomeData["lastWorkout"] }) {
  return (
    <Card className="h-full">
      <CardHeader icon={<Dumbbell />} title="Último treino" href="/academia" hrefLabel="Academia" />
      <div className="px-5 pb-5">
        {workout ? (
          <>
            <div className="text-[15px] font-medium">{workout.name}</div>
            <div className="mt-1 text-[12.5px] text-muted">{relativeDay(workout.date)}{workout.minutes ? ` · ${workout.minutes} min` : ""}{workout.exercises.length ? ` · ${workout.exercises.length} exercícios` : ""}</div>
          </>
        ) : (
          <p className="text-[13px] text-muted">Nenhum treino registrado ainda.</p>
        )}
      </div>
    </Card>
  );
}

export function FinanceWidget({ finance }: { finance: HomeData["finance"] }) {
  return (
    <Card className="h-full">
      <CardHeader icon={<Wallet />} title="Finanças do mês" href="/financas" hrefLabel="Finanças" />
      <div className="grid grid-cols-3 gap-2 px-5 pb-5">
        <Stat label="Entradas" value={formatBRL(finance.income)} tone="text-success" />
        <Stat label="Saídas" value={formatBRL(finance.expense)} tone="text-danger" />
        <Stat label="Saldo" value={formatBRL(finance.balance)} tone={finance.balance >= 0 ? "text-fg" : "text-danger"} />
        {finance.top && <p className="col-span-3 text-[12px] text-faint">Maior gasto: {finance.top.name} ({formatBRL(finance.top.value)})</p>}
      </div>
    </Card>
  );
}

export function ReadingWidget({ books }: { books: HomeData["books"] }) {
  return (
    <Card className="h-full">
      <CardHeader icon={<BookOpen />} title="Leitura" href="/leitura" hrefLabel="Leitura" />
      <div className="space-y-3 px-5 pb-5">
        {books.length === 0 && <p className="text-[13px] text-muted">Nenhum livro em andamento.</p>}
        {books.slice(0, 3).map((b) => {
          const pct = b.totalPages ? (b.currentPage / b.totalPages) * 100 : 0;
          return (
            <div key={b.id}>
              <div className="flex justify-between text-[13.5px]"><span className="truncate">{b.title}</span><span className="text-[12px] text-muted">{b.currentPage}/{b.totalPages ?? "?"}</span></div>
              <Progress value={pct} className="mt-1.5" />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11.5px] text-muted">{label}</div>
      <div className={cn("truncate text-[17px] font-semibold tabular-nums", tone)}>{value}</div>
    </div>
  );
}

function fmtMin(m: number) {
  if (m < 60) return `${m}min`;
  return `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;
}

export { formatNumber };
