import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { cn } from "@/lib/utils";

/* Peças pequenas para widgets: HTML e SVG puros, renderizados no servidor.
   Cada gráfico tem rótulo acessível; números ficam na cor do texto e a cor
   da marca carrega a identidade ou o estado. */

export type Tone = "ok" | "warn" | "err" | "idle" | "accent";

export const TONE_BG: Record<Tone, string> = {
  ok: "bg-success",
  warn: "bg-warning",
  err: "bg-danger",
  idle: "bg-faint/50",
  accent: "bg-[var(--chart-1)]",
};
export const TONE_TEXT: Record<Tone, string> = {
  ok: "text-success",
  warn: "text-warning",
  err: "text-danger",
  idle: "text-muted",
  accent: "text-fg",
};

/** Moldura de um widget: título discreto, meta à direita e conteúdo que ocupa o resto. */
export function WidgetShell({ title, meta, href, hrefLabel, children, className }: {
  title: string;
  meta?: React.ReactNode;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("@container flex h-full min-h-0 flex-col gap-3 p-4 sm:p-5", className)}>
      <header className="flex items-center justify-between gap-3 leading-none">
        <h3 className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{title}</h3>
        <span className="flex shrink-0 items-center gap-2 text-[11.5px] text-faint">
          {meta}
          {href && (
            <Link href={href} className="inline-flex items-center gap-0.5 text-muted transition hover:text-fg">
              {hrefLabel ?? "Ver"}<ArrowUpRight className="size-3" />
            </Link>
          )}
        </span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

/** Número principal do widget, com unidade opcional. */
export function Big({ children, unit, tone }: { children: React.ReactNode; unit?: React.ReactNode; tone?: Tone }) {
  return (
    <p className={cn("text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums", tone ? TONE_TEXT[tone] : "text-fg")}>
      {children}
      {unit && <span className="ml-1.5 text-[12.5px] font-normal tracking-normal text-muted">{unit}</span>}
    </p>
  );
}

export function Dot({ tone, pulse = false }: { tone: Tone; pulse?: boolean }) {
  return (
    <span aria-hidden className="relative inline-flex size-2 shrink-0">
      {pulse && <span className={cn("absolute inset-0 animate-ping rounded-full opacity-50 motion-reduce:hidden", TONE_BG[tone])} />}
      <span className={cn("relative size-2 rounded-full", TONE_BG[tone])} />
    </span>
  );
}

/** Colunas por dia (ou período). Cada coluna pode ter segmentos empilhados. */
export function ColumnBars({ columns, label, height = 56, className, axis }: {
  columns: { label: string; segments: { value: number; tone: Tone; name: string }[] }[];
  label: string;
  height?: number;
  className?: string;
  /** Rótulos sob o eixo: início e fim. */
  axis?: [string, string];
}) {
  const max = Math.max(1, ...columns.map((c) => c.segments.reduce((n, s) => n + s.value, 0)));
  return (
    <div className={className}>
      <div role="img" aria-label={label} className="flex items-end gap-[3px]" style={{ height }}>
        {columns.map((c) => {
          const total = c.segments.reduce((n, s) => n + s.value, 0);
          return (
            <span key={c.label} title={`${c.label} · ${c.segments.filter((s) => s.value).map((s) => `${s.value} ${s.name}`).join(" · ") || "nenhum"}`} className="group relative flex h-full flex-1 flex-col justify-end">
              {total === 0 ? (
                <span className="h-[3px] rounded-full bg-fg/[0.08]" />
              ) : (
                <span className="flex flex-col-reverse gap-px overflow-hidden rounded-[4px] transition-opacity group-hover:opacity-80" style={{ height: `${Math.max(8, (total / max) * 100)}%` }}>
                  {c.segments.filter((s) => s.value > 0).map((s) => <span key={s.name} className={TONE_BG[s.tone]} style={{ flexGrow: s.value }} />)}
                </span>
              )}
            </span>
          );
        })}
      </div>
      {axis && <div aria-hidden className="mt-1.5 flex justify-between text-[10.5px] text-faint"><span>{axis[0]}</span><span>{axis[1]}</span></div>}
    </div>
  );
}

/** Lista de barras horizontais com rótulo e valor. */
export function BarRows({ rows, max, label, className }: {
  rows: { key: string; label: React.ReactNode; value: number; display: React.ReactNode; tone?: Tone; hint?: string }[];
  max?: number;
  label: string;
  className?: string;
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul aria-label={label} className={cn("space-y-2", className)}>
      {rows.map((r) => (
        <li key={r.key} title={r.hint} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-[12.5px]">
          <span className="min-w-0 truncate text-fg">{r.label}</span>
          <span className="text-right tabular-nums text-muted">{r.display}</span>
          <span aria-hidden className="col-span-2 block h-[4px] overflow-hidden rounded-full bg-fg/[0.07]">
            <span className={cn("block h-full rounded-full", TONE_BG[r.tone ?? "accent"])} style={{ width: `${Math.min(100, Math.max(2, (r.value / top) * 100))}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Anel de proporção (SVG). */
export function Ring({ value, total, tone = "accent", size = 76, stroke = 8, label, children }: {
  value: number; total: number; tone?: Tone; size?: number; stroke?: number; label: string; children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const share = total > 0 ? Math.min(1, value / total) : 0;
  const colorVar = tone === "ok" ? "var(--success)" : tone === "warn" ? "var(--warning)" : tone === "err" ? "var(--danger)" : tone === "idle" ? "var(--faint)" : "var(--chart-1)";
  return (
    <div role="img" aria-label={label} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        {share > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colorVar} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * share} ${c}`} className="transition-[stroke-dasharray] duration-700" />}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">{children}</div>
    </div>
  );
}

/** Faixa de participação: partes proporcionais lado a lado. */
export function ShareStrip({ parts, label, className }: { parts: { name: string; value: number; tone: Tone }[]; label: string; className?: string }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  return (
    <div role="img" aria-label={label} className={cn("flex h-2 gap-[3px]", className)}>
      {total === 0 ? <span className="h-full flex-1 rounded-full bg-fg/[0.08]" /> : parts.filter((p) => p.value > 0).map((p) => (
        <span key={p.name} title={`${p.name}: ${p.value}`} className={cn("h-full rounded-full", TONE_BG[p.tone])} style={{ flexGrow: p.value }} />
      ))}
    </div>
  );
}

/** Legenda compacta para faixas e colunas. */
export function Legend({ items, className }: { items: { name: string; tone: Tone; value?: React.ReactNode }[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-3.5 gap-y-1 text-[11.5px] text-muted", className)}>
      {items.map((i) => (
        <li key={i.name} className="flex items-center gap-1.5">
          <span aria-hidden className={cn("size-2 rounded-[3px]", TONE_BG[i.tone])} />
          {i.name}{i.value !== undefined && <span className="tabular-nums text-fg">{i.value}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Dias de calendário (últimos N), do mais antigo ao mais recente, no fuso de São Paulo. */
export function lastDays(n: number, now = Date.now()) {
  const key = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return Array.from({ length: n }, (_, i) => {
    const t = now - (n - 1 - i) * 86_400_000;
    return { key: key(t), label: new Date(t).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }) };
  });
}
export const dayKey = (d: Date | string | number) => new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
