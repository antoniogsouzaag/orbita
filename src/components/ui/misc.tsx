"use client";
import { Check } from "lucide-react";
import { Tooltip as T } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-border-strong bg-surface-2 px-1 font-mono text-[10.5px] text-muted", className)}>
      {children}
    </kbd>
  );
}

export function Chip({ color, children, className }: { color?: string; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn("inline-flex max-w-[9rem] items-center gap-1.5 truncate rounded-full px-2 py-0.5 text-[11.5px] font-medium", className)}
      style={color ? { background: `color-mix(in oklab, ${color} 16%, transparent)`, color } : undefined}
    >
      {color && <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />}
      <span className="truncate">{children}</span>
    </span>
  );
}

export function Progress({ value, color, className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}>
      <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

/** Checkbox redondo (tarefas) ou quadrado (hábitos). */
export function CheckButton({
  checked,
  onToggle,
  shape = "circle",
  color,
  label,
  size = "md",
}: {
  checked: boolean;
  onToggle: () => void;
  shape?: "circle" | "square";
  color?: string;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "grid shrink-0 place-items-center border transition-all duration-200 active:scale-90",
        size === "md" ? "size-[22px]" : "size-[18px]",
        shape === "circle" ? "rounded-full" : "rounded-[8px]",
        checked ? "border-transparent text-white" : "border-border-strong hover:border-muted",
      )}
      style={checked ? { background: color ?? "var(--accent)", color: color ? "#fff" : "var(--accent-fg)" } : undefined}
    >
      {checked && <Check className={size === "md" ? "size-3.5" : "size-3"} strokeWidth={3} />}
    </button>
  );
}

export function Tooltip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <T.Provider delayDuration={250}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal>
          <T.Content side={side} sideOffset={6} className="z-[80] rounded-lg border border-border-strong bg-surface-2 px-2 py-1 text-xs text-fg shadow-soft animate-in">
            {content}
          </T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-xl border border-border bg-surface-2 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-[10px] px-3 py-1.5 text-[13px] font-medium transition",
            value === o.value ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
