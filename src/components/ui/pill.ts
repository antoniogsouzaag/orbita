import { cn } from "@/lib/utils";

/** Filtro em pílula (botão com aria-pressed). Mesmo visual em todas as telas. */
export function pillClass(active: boolean, className?: string) {
  return cn(
    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
    active ? "border-accent/35 bg-accent/10 text-accent" : "border-border text-muted hover:border-border-strong hover:bg-surface-2 hover:text-fg",
    className,
  );
}
