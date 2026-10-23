import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type StatTone = "neutral" | "accent" | "success" | "warning" | "danger";

const TONE: Record<StatTone, { chip: string; value: string }> = {
  neutral: { chip: "bg-surface-2 text-muted", value: "text-fg" },
  accent: { chip: "bg-accent/12 text-accent", value: "text-fg" },
  success: { chip: "bg-success/12 text-success", value: "text-success" },
  warning: { chip: "bg-warning/12 text-warning", value: "text-warning" },
  danger: { chip: "bg-danger/12 text-danger", value: "text-danger" },
};

/** Indicador padrão: rótulo, número grande e ícone com a cor do estado. */
export function StatTile({ icon: Icon, label, value, tone = "neutral", href, hint, colorValue = true }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; tone?: StatTone; href?: string; hint?: React.ReactNode; colorValue?: boolean }) {
  const t = TONE[tone];
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium text-muted">{label}</span>
        <span className={cn("grid size-8 place-items-center rounded-xl", t.chip)}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className={cn("mt-2 text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums", colorValue ? t.value : "text-fg")}>{value}</div>
      {hint && <div className="mt-1.5 text-[12px] text-faint">{hint}</div>}
      {href && <ArrowUpRight className="absolute right-3 bottom-3 size-3.5 text-faint opacity-0 transition group-hover:opacity-100" />}
    </>
  );
  const cls = "card group relative block p-4 transition";
  return href ? <Link href={href} className={cn(cls, "hover:border-border-strong")}>{body}</Link> : <div className={cls}>{body}</div>;
}
