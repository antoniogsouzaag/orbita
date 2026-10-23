"use client";

import { Activity, ArrowDownRight, ArrowUpRight, CalendarDays, CheckCheck, Heart, ListChecks, Minus, Repeat2, Timer, Wallet } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { Card } from "@/components/ui/card";
import { cn, formatBRL } from "@/lib/utils";
import { formatReviewDuration, REVIEW_PERIODS, reviewDelta, reviewWindow, type ReviewPeriod, type ReviewPoint } from "./review-model";

type Note = { date: string; note: string | null };
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const axis = { tick: { fontSize: 10.5, fill: "var(--muted)" }, axisLine: false, tickLine: false, tickMargin: 10 } as const;
const margin = { top: 15, right: 16, bottom: 5, left: 0 };
const colors = { tasks: "#8895f5", habits: "#56bc96", mood: "#e9b568", energy: "#63c7ce", focus: "#b49af1" };
const fullDate = (date: string) => new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const shortDate = (date: string) => `${date.slice(8)}/${date.slice(5, 7)}`;

function ChartTip({ active, payload, label, kind }: Partial<TooltipContentProps> & { kind: "tasks" | "habits" | "wellbeing" | "focus" }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as ReviewPoint | undefined;
  const entries = kind === "wellbeing" ? [{ name: "Humor", value: point?.mood, color: colors.mood }, { name: "Energia", value: point?.energy, color: colors.energy }] : payload.map((entry) => ({ name: String(entry.name), value: typeof entry.value === "number" ? entry.value : null, color: entry.color }));
  return <div className="min-w-44 rounded-xl border border-border-strong bg-surface px-3.5 py-3 text-xs shadow-xl"><p className="mb-2 font-medium text-fg">{point?.date ? fullDate(point.date) : label}</p><div className="space-y-1.5">{entries.map((entry) => <div key={entry.name} className="flex items-center justify-between gap-5"><span className="flex items-center gap-2 text-muted"><span className="size-2 rounded-full" style={{ background: entry.color }} />{entry.name}</span><span className="font-medium tabular-nums text-fg">{entry.value == null ? "Sem registro" : kind === "focus" ? formatReviewDuration(entry.value) : `${number.format(entry.value)}${kind === "habits" ? "%" : kind === "wellbeing" ? " / 5" : entry.value === 1 ? " tarefa" : " tarefas"}`}</span></div>)}</div></div>;
}

function Delta({ now, before, available }: { now: number | null; before: number | null; available: boolean }) {
  const delta = available ? reviewDelta(now, before) : null;
  if (delta === null) return <span className="text-[10.5px] text-faint">Sem base de comparação</span>;
  return <span className={cn("inline-flex items-center gap-1 text-[10.5px]", delta > 0 ? "text-success" : "text-muted")} title="Variação em relação ao período anterior de mesma duração">{delta > 0 ? <ArrowUpRight className="size-3" /> : delta < 0 ? <ArrowDownRight className="size-3" /> : <Minus className="size-3" />}{delta > 0 ? "+" : ""}{delta}% no período</span>;
}

function ChartCard({ title, subtitle, icon, metric, detail, legend, children }: { title: string; subtitle: string; icon: React.ReactNode; metric: string; detail: string; legend: { name: string; color: string }[]; children: React.ReactNode }) {
  return <Card className="min-w-0 overflow-hidden"><div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><span className="text-muted [&_svg]:size-4">{icon}</span>{title}</h2><p className="mt-1 text-[11.5px] text-faint">{subtitle}</p></div><div className="text-right"><p className="text-xl font-semibold tracking-tight tabular-nums">{metric}</p><p className="mt-0.5 text-[10.5px] text-faint">{detail}</p></div></div><div className="flex flex-wrap items-center gap-3 px-5 pt-4 text-[10.5px] text-muted">{legend.map((item) => <span key={item.name} className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full" style={{ background: item.color }} />{item.name}</span>)}</div><div className="h-[240px] px-2 pb-3 pt-2">{children}</div></Card>;
}

function EmptyChart({ title, text, href, action }: { title: string; text: string; href: string; action: string }) {
  return <div className="mx-3 flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-2/20 px-5 text-center"><Activity className="mb-1 size-5 text-faint" /><p className="text-xs font-medium text-muted">{title}</p><p className="max-w-xs text-[11px] leading-relaxed text-faint">{text}</p><Link href={href} className="mt-1 rounded text-[11px] font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">{action} →</Link></div>;
}

export function ReviewCharts({ data, notes = [] }: { data: ReviewPoint[]; notes?: Note[] }) {
  const [period, setPeriod] = React.useState<ReviewPeriod>(7);
  const id = React.useId().replace(/:/g, "");
  const { current, totals, before, comparable } = React.useMemo(() => reviewWindow(data, period), [data, period]);
  const firstDate = current[0]?.date;
  const lastDate = current.at(-1)?.date;
  const interval = period === 7 ? 0 : period === 14 ? 2 : 5;
  const visibleNotes = notes.filter((note) => firstDate && note.date >= firstDate && note.date <= (lastDate ?? "")).sort((a, b) => b.date.localeCompare(a.date));
  const tiles = [
    { name: "Tarefas concluídas", value: number.format(totals.tasks), icon: <CheckCheck />, help: `${current.filter((point) => point.tasks > 0).length} dias com entregas`, delta: <Delta now={totals.tasks} before={before.tasks} available={comparable} /> },
    { name: "Tempo de foco", value: formatReviewDuration(totals.focus), icon: <Timer />, help: `${number.format(Math.round(totals.focus / period))} min por dia`, delta: <Delta now={totals.focus} before={before.focus} available={comparable} /> },
    { name: "Hábitos cumpridos", value: totals.habits === null ? "—" : `${number.format(totals.habits)}%`, icon: <Repeat2 />, help: `${totals.habitDays} dias com hábitos previstos`, delta: <Delta now={totals.habits} before={before.habits} available={comparable} /> },
    { name: "Humor / energia", value: `${totals.mood === null ? "—" : number.format(totals.mood)} / ${totals.energy === null ? "—" : number.format(totals.energy)}`, icon: <Heart />, help: `Escala de 1 a 5 · ${totals.checkinDays} check-ins`, delta: null },
    { name: "Despesas registradas", value: formatBRL(totals.spend), icon: <Wallet />, help: `Total em ${period} dias`, delta: null },
  ];

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs text-muted"><CalendarDays className="size-4 text-faint" /><span aria-live="polite">{firstDate && lastDate ? `${shortDate(firstDate)} a ${shortDate(lastDate)} · ${period} dias` : "Período sem dados"}</span></div><div className="flex rounded-xl border border-border bg-surface-2/60 p-1" role="group" aria-label="Período da revisão">{REVIEW_PERIODS.map((days) => <button key={days} type="button" aria-pressed={period === days} onClick={() => setPeriod(days)} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40", period === days ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg")}>{days} dias</button>)}</div></div>

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">{tiles.map((tile) => <Card key={tile.name} className="min-w-0 p-4"><div className="mb-3 flex items-center gap-2 text-[11.5px] text-muted"><span className="text-faint [&_svg]:size-3.5">{tile.icon}</span>{tile.name}</div><div className="truncate text-[23px] font-semibold tracking-tight tabular-nums" title={tile.value}>{tile.value}</div><p className="mt-1 text-[10.5px] text-faint">{tile.help}</p>{tile.delta && <div className="mt-3 border-t border-border/70 pt-2">{tile.delta}</div>}</Card>)}</div>

    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Entregas" subtitle="Tarefas concluídas por dia" icon={<ListChecks />} metric={number.format(totals.tasks)} detail={`tarefas em ${period} dias`} legend={[{ name: "Tarefas concluídas", color: colors.tasks }]}>
        {totals.tasks > 0 ? <ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart accessibilityLayer data={current} margin={margin}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" /><XAxis dataKey="label" {...axis} interval={interval} /><YAxis {...axis} width={38} allowDecimals={false} /><Tooltip content={(props) => <ChartTip {...props} kind="tasks" />} cursor={{ fill: "var(--surface-2)" }} /><Bar dataKey="tasks" name="Concluídas" fill={colors.tasks} radius={[5, 5, 0, 0]} maxBarSize={30} animationDuration={350} /></BarChart></ResponsiveContainer> : <EmptyChart title="Nenhuma tarefa concluída neste período" text="Suas entregas aparecem aqui conforme as tarefas forem concluídas." href="/tarefas" action="Organizar tarefas" />}
      </ChartCard>

      <ChartCard title="Consistência" subtitle="Conclusão dos hábitos previstos no dia" icon={<Repeat2 />} metric={totals.habits === null ? "—" : `${number.format(totals.habits)}%`} detail={`média de ${totals.habitDays} dias previstos`} legend={[{ name: "Hábitos cumpridos (%)", color: colors.habits }]}>
        {totals.habitDays ? <ResponsiveContainer width="100%" height="100%" minWidth={0}><AreaChart accessibilityLayer data={current} margin={margin}><defs><linearGradient id={`habits-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={colors.habits} stopOpacity={0.28} /><stop offset="100%" stopColor={colors.habits} stopOpacity={0.015} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" /><XAxis dataKey="label" {...axis} interval={interval} /><YAxis {...axis} width={43} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} /><Tooltip content={(props) => <ChartTip {...props} kind="habits" />} cursor={{ stroke: "var(--border-strong)" }} /><Area type="monotone" dataKey="habits" name="Cumpridos" stroke={colors.habits} strokeWidth={2.5} fill={`url(#habits-${id})`} dot={{ r: 2, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 3, stroke: "var(--surface)" }} connectNulls={false} animationDuration={350} /></AreaChart></ResponsiveContainer> : <EmptyChart title="Sem hábitos previstos neste período" text="Dias sem hábitos agendados ficam sem registro. Eles não reduzem sua média." href="/habitos" action="Criar um hábito" />}
      </ChartCard>

      <ChartCard title="Bem-estar" subtitle="Humor e energia registrados no check-in" icon={<Heart />} metric={`${totals.checkinDays}/${period}`} detail="dias com check-in" legend={[{ name: "Humor · escala 1–5", color: colors.mood }, { name: "Energia · escala 1–5", color: colors.energy }]}>
        {totals.checkinDays ? <ResponsiveContainer width="100%" height="100%" minWidth={0}><LineChart accessibilityLayer data={current} margin={margin}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" /><XAxis dataKey="label" {...axis} interval={interval} /><YAxis {...axis} width={30} domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} /><Tooltip filterNull={false} content={(props) => <ChartTip {...props} kind="wellbeing" />} cursor={{ stroke: "var(--border-strong)" }} /><Line type="monotone" dataKey="mood" name="Humor" stroke={colors.mood} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0 }} activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 3 }} connectNulls={false} animationDuration={350} /><Line type="monotone" dataKey="energy" name="Energia" stroke={colors.energy} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0 }} activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 3 }} connectNulls={false} animationDuration={350} /></LineChart></ResponsiveContainer> : <EmptyChart title="Nenhum check-in neste período" text="Registre como você está para acompanhar seu ritmo. Dias sem check-in permanecem vazios." href="/" action="Fazer check-in no início" />}
      </ChartCard>

      <ChartCard title="Foco profundo" subtitle="Tempo dedicado em sessões de foco" icon={<Timer />} metric={formatReviewDuration(totals.focus)} detail={`total em ${period} dias`} legend={[{ name: "Minutos de foco", color: colors.focus }]}>
        {totals.focus > 0 ? <ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart accessibilityLayer data={current} margin={margin}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" /><XAxis dataKey="label" {...axis} interval={interval} /><YAxis {...axis} width={45} tickFormatter={(value) => `${value}m`} /><Tooltip content={(props) => <ChartTip {...props} kind="focus" />} cursor={{ fill: "var(--surface-2)" }} /><Bar dataKey="focus" name="Foco" fill={colors.focus} radius={[5, 5, 0, 0]} maxBarSize={30} animationDuration={350} /></BarChart></ResponsiveContainer> : <EmptyChart title="Sem sessões de foco neste período" text="Sessões concluídas se tornam uma visão clara do seu tempo de concentração." href="/foco" action="Iniciar uma sessão" />}
      </ChartCard>
    </div>
    <p className="px-1 text-[11px] leading-relaxed text-faint">As variações comparam os {period} dias selecionados com os {period} anteriores. Hábitos usam apenas dias com agenda; humor e energia usam apenas check-ins registrados. Lacunas representam ausência de registro.</p>

    <Card className="p-5"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">Reflexões recentes do período</h2><span className="text-[11px] text-faint">{visibleNotes.length} de até 10 notas recentes</span></div>{visibleNotes.length ? <div className="space-y-4">{visibleNotes.map((note) => <div key={note.date} className="flex gap-3 border-l-2 border-accent/25 pl-3"><span className="w-10 shrink-0 pt-0.5 text-[11px] tabular-nums text-faint">{shortDate(note.date)}</span><p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-muted">{note.note}</p></div>)}</div> : <p className="text-xs leading-relaxed text-muted">Suas notas de check-in aparecerão aqui. Uma breve reflexão ajuda a identificar o que merece continuar e o que precisa mudar.</p>}</Card>
  </div>;
}
