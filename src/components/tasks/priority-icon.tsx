import { cn } from "@/lib/utils";

/** Barrinhas de sinal: 1 baixa, 2 média, 3 alta. */
export function PriorityIcon({ level, className }: { level: number; className?: string }) {
  if (!level) return <span className={cn("block h-px w-3 bg-faint", className)} aria-label="Sem prioridade" />;
  const color = level === 3 ? "var(--danger)" : level === 2 ? "var(--warning)" : "var(--muted)";
  return (
    <svg viewBox="0 0 14 12" className={cn("h-3 w-3.5", className)} aria-label={["", "Baixa", "Média", "Alta"][level]}>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={i * 3.6} y={9 - i * 3} width="2.4" height={3 + i * 3} rx="0.8" fill={i < level + 1 ? color : "var(--border-strong)"} />
      ))}
    </svg>
  );
}
