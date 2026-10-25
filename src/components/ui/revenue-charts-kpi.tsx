"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";

/* Kit de gráficos (base Layro ChartCard), adaptado aos tokens da Órbita.
   · a cor segue a série em ordem fixa (--chart-1 … --chart-5), nunca o ranking
   · um único eixo y; medidas de escalas diferentes viram dois gráficos
   · marcas finas: linhas de 2px, barras até 24px com ponta arredondada de 4px
   · texto nunca usa a cor da série; a amostra ao lado carrega a identidade
   · todo gráfico tem tooltip e uma tabela oculta para leitores de tela
   Os formatadores são chaves (não funções) para que páginas do servidor possam
   renderizar estes componentes passando só dados serializáveis. */

export type ValueFormat = "number" | "compact" | "brl" | "percent" | "ms" | "days";
type Slot = 1 | 2 | 3 | 4 | 5;

const FORMATS: Record<ValueFormat, (v: number) => string> = {
  number: (v) => v.toLocaleString("pt-BR"),
  compact: (v) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v),
  brl: (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }),
  percent: (v) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
  ms: (v) => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}s` : `${Math.round(v)}ms`),
  days: (v) => `${Math.round(v)}d`,
};
const fmt = (f: ValueFormat = "number") => FORMATS[f];

export interface Series {
  /** Chave em cada linha de dados. */
  key: string;
  label: string;
  /** Posição 1–5. Mantenha estável entre filtros. */
  slot?: Slot;
}

const color = (s: Series, i: number) => `var(--chart-${s.slot ?? (i % 5) + 1})`;
const AXIS = { fill: "var(--faint)", fontSize: 11 };

/* ---------------------------------------------------------------- card -- */

export interface ChartCardProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Lado direito do cabeçalho: seletor de período, link. */
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function ChartCard({ title, subtitle, actions, footer, className, children, ...rest }: ChartCardProps) {
  return (
    <figure className={cn("card m-0 flex min-w-0 flex-col gap-3 p-4", className)} {...rest}>
      <figcaption className="flex items-start justify-between gap-3">
        <div className="grid min-w-0 gap-0.5">
          <span className="text-[14px] font-semibold tracking-[-0.01em]">{title}</span>
          {subtitle && <span className="text-[12px] text-muted">{subtitle}</span>}
        </div>
        {actions}
      </figcaption>
      <div className="min-w-0 flex-1">{children}</div>
      {footer && <p className="border-t border-border pt-3 text-[11px] leading-relaxed text-faint">{footer}</p>}
    </figure>
  );
}

/* ------------------------------------------------------------ helpers -- */

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-hidden>
      {series.map((s, i) => (
        <li key={s.key} className="flex items-center gap-1.5 text-[12px] text-muted">
          <span className="size-2 rounded-[3px]" style={{ background: color(s, i) }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

type TipPayload = { dataKey?: string | number; name?: string; value?: number | string; payload?: { slot?: Slot; label?: string } };

function ChartTooltip({ active, payload, label, series, format }: { active?: boolean; payload?: TipPayload[]; label?: string | number; series: Series[]; format: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[150px] rounded-xl border border-border-strong bg-surface px-3 py-2 text-[12px] text-fg shadow-lg">
      {label !== undefined && label !== "" && <p className="mb-1.5 font-medium">{label}</p>}
      <ul className="grid gap-1">
        {payload.map((p, n) => {
          const i = series.findIndex((s) => s.key === p.dataKey);
          const s = series[i] ?? { key: String(p.name ?? n), label: String(p.name ?? ""), slot: p.payload?.slot };
          return (
            <li key={`${s.key}-${n}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="size-2 rounded-[3px]" style={{ background: color(s, Math.max(i, n)) }} />
                {s.label}
              </span>
              <span className="font-medium tabular-nums">{format(Number(p.value))}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DataTableFallback({ caption, data, xKey, series, format }: { caption: string; data: Record<string, unknown>[]; xKey: string; series: Series[]; format: (v: number) => string }) {
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{xKey}</th>
            {series.map((s) => <th key={s.key} scope="col">{s.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <th scope="row">{String(row[xKey])}</th>
              {series.map((s) => <td key={s.key}>{row[s.key] == null ? "—" : format(Number(row[s.key]))}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Evita o aviso de tamanho 0 do ResponsiveContainer durante a hidratação. */
const noop = () => () => {};
function useMounted() {
  return React.useSyncExternalStore(noop, () => true, () => false);
}

interface CartesianProps {
  data: Record<string, unknown>[];
  xKey: string;
  series: Series[];
  format?: ValueFormat;
  height?: number;
  /** Resumo acessível, lido antes da tabela. */
  description: string;
  stacked?: boolean;
  className?: string;
}

/* ---------------------------------------------------------- area trend -- */

export function AreaTrend({ data, xKey, series, format = "number", height = 220, description, stacked = false, className }: CartesianProps) {
  const id = React.useId().replace(/:/g, "");
  const f = fmt(format);
  const mounted = useMounted();
  return (
    <div className={cn("grid min-w-0 gap-2", className)}>
      <Legend series={series} />
      <div role="img" aria-label={description} className="min-w-0 overflow-hidden" style={{ height, minHeight: height }}>
        {mounted && <div aria-hidden className="size-full"><ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
            <defs>
              {series.map((s, i) => (
                <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color(s, i)} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={color(s, i)} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={AXIS} tickMargin={8} minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} tick={AXIS} tickFormatter={fmt(format === "brl" ? "compact" : format)} width={44} allowDecimals={false} />
            <RTooltip cursor={{ stroke: "var(--faint)", strokeWidth: 1 }} content={<ChartTooltip series={series} format={f} />} />
            {series.map((s, i) => (
              <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stackId={stacked ? "a" : undefined} stroke={color(s, i)} strokeWidth={2} fill={`url(#${id}-${s.key})`} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)", fill: color(s, i) }} isAnimationActive={false} />
            ))}
          </AreaChart>
        </ResponsiveContainer></div>}
      </div>
      <DataTableFallback caption={description} data={data} xKey={xKey} series={series} format={f} />
    </div>
  );
}

/* --------------------------------------------------------- bar compare -- */

export function BarCompare({ data, xKey, series, format = "number", height = 220, description, stacked = false, horizontal = false, className }: CartesianProps & { horizontal?: boolean }) {
  const f = fmt(format);
  const mounted = useMounted();
  const tick = fmt(format === "brl" ? "compact" : format);
  return (
    <div className={cn("grid min-w-0 gap-2", className)}>
      <Legend series={series} />
      <div role="img" aria-label={description} className="min-w-0 overflow-hidden" style={{ height, minHeight: height }}>
        {mounted && <div aria-hidden className="size-full"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 6, right: 6, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke="var(--border)" />
            {horizontal ? <>
              <XAxis type="number" tickLine={false} axisLine={false} tick={AXIS} tickFormatter={tick} allowDecimals={false} />
              <YAxis type="category" dataKey={xKey} tickLine={false} axisLine={false} tick={AXIS} width={92} />
            </> : <>
              <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={AXIS} tickMargin={8} interval="preserveStartEnd" />
              <YAxis tickLine={false} axisLine={false} tick={AXIS} tickFormatter={tick} width={40} allowDecimals={false} />
            </>}
            <RTooltip cursor={{ fill: "var(--surface-2)", opacity: 0.7 }} content={<ChartTooltip series={series} format={f} />} />
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} stackId={stacked ? "a" : undefined} fill={color(s, i)} maxBarSize={24}
                radius={stacked && i < series.length - 1 ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                stroke={stacked ? "var(--surface)" : undefined} strokeWidth={stacked ? 2 : 0} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer></div>}
      </div>
      <DataTableFallback caption={description} data={data} xKey={xKey} series={series} format={f} />
    </div>
  );
}

/* ------------------------------------------------------ donut breakdown -- */

export interface DonutSlice {
  label: string;
  value: number;
  slot?: Slot;
  /** Cor fixa (ex.: var(--success)) para fatias de estado. */
  color?: string;
}

export function DonutBreakdown({ data, format = "number", centerLabel = "Total", description, size = 168, className }: {
  data: DonutSlice[];
  format?: ValueFormat;
  centerLabel?: string;
  description: string;
  size?: number;
  className?: string;
}) {
  const f = fmt(format);
  const mounted = useMounted();
  const total = data.reduce((n, d) => n + d.value, 0);
  const series: Series[] = data.map((d, i) => ({ key: d.label, label: d.label, slot: d.slot ?? (((i % 5) + 1) as Slot) }));
  const fill = (i: number) => data[i].color ?? color(series[i], i);
  return (
    <div className={cn("flex flex-wrap items-center gap-6", className)}>
      <div role="img" aria-label={description} className="relative shrink-0" style={{ width: size, height: size }}>
        {mounted && total > 0 && <div aria-hidden className="size-full"><ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="70%" outerRadius="100%" stroke="var(--surface)" strokeWidth={2} startAngle={90} endAngle={-270} rootTabIndex={-1} isAnimationActive={false}>
              {data.map((d, i) => <Cell key={d.label} fill={fill(i)} />)}
            </Pie>
            <RTooltip content={<ChartTooltip series={series} format={f} />} />
          </PieChart>
        </ResponsiveContainer></div>}
        {total === 0 && <div aria-hidden className="absolute inset-0 rounded-full border-[10px] border-surface-2" />}
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <span className="text-[11px] text-muted">{centerLabel}</span>
          <span className="text-[17px] font-semibold tabular-nums">{f(total)}</span>
        </div>
      </div>
      <ul className="grid min-w-[160px] max-w-[340px] flex-1 gap-2">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center justify-between gap-4 text-[12.5px]">
            <span className="flex min-w-0 items-center gap-2 text-muted">
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: fill(i) }} />
              <span className="truncate">{d.label}</span>
            </span>
            <span className="shrink-0 tabular-nums">
              <span className="font-medium">{f(d.value)}</span>
              <span className="ml-2 text-faint">{total ? Math.round((d.value / total) * 100) : 0}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------------------------- sparkline and KPI -- */

export function Sparkline({ data, slot = 1, height = 36, className }: { data: number[]; slot?: Slot; height?: number; className?: string }) {
  const mounted = useMounted();
  const rows = data.map((v, i) => ({ i, v }));
  return (
    <div aria-hidden className={cn("min-w-0 overflow-hidden", className)} style={{ height, minHeight: height }}>
      {mounted && <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <Line type="monotone" dataKey="v" stroke={`var(--chart-${slot})`} strokeWidth={2} dot={false} isAnimationActive={false} strokeLinecap="round" />
        </LineChart>
      </ResponsiveContainer>}
    </div>
  );
}

export interface KpiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  /** Variação contra o período anterior, como fração: 0.124 = +12,4%. */
  delta?: number;
  /** Se subir é bom (receita) ou ruim (falhas). */
  good?: "up" | "down";
  /** Com o que a variação compara: "vs ontem". */
  period?: string;
  hint?: React.ReactNode;
  trend?: number[];
  /** Elemento do ícone (ex.: <Users />), para funcionar também vindo do servidor. */
  icon?: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}

const TONE = { neutral: "bg-surface-2 text-muted", success: "bg-success/12 text-success", warning: "bg-warning/12 text-warning", danger: "bg-danger/12 text-danger" };

export function KpiCard({ label, value, delta, good = "up", period, hint, trend, icon, tone = "neutral", className, ...rest }: KpiCardProps) {
  const up = (delta ?? 0) >= 0;
  const positive = delta === undefined ? null : (up && good === "up") || (!up && good === "down");
  return (
    <div className={cn("card grid min-w-0 content-start gap-2 p-4", className)} {...rest}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[12px] font-medium text-muted">{label}</p>
        {icon && <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg [&_svg]:size-3.5", TONE[tone])}>{icon}</span>}
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="text-[24px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{value}</p>
        {trend && trend.length > 1 && <Sparkline data={trend} className="w-20" slot={1} height={28} />}
      </div>
      {delta !== undefined && Number.isFinite(delta) && (
        <p className="flex items-center gap-1 text-[12px]">
          <span className={cn("inline-flex items-center gap-0.5 font-medium tabular-nums", positive ? "text-success" : "text-danger")}>
            {up ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
            <span className="sr-only">{up ? "Subiu" : "Caiu"} </span>
            {Math.abs(delta * 100).toFixed(1)}%
          </span>
          {period && <span className="text-faint">{period}</span>}
        </p>
      )}
      {hint && <p className="truncate text-[11.5px] text-faint">{hint}</p>}
    </div>
  );
}

export { ChartCard as Component };
