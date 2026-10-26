"use client";

import { AlertCircle, ChevronDown, Command } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/* Status de execução de um agente, no estilo Claude/ChatGPT.
 * Adaptado de "ai-agent-response" para dados ao vivo: o progresso vem do
 * servidor (etapas reais), não de uma animação simulada. */

const DOT_DELAYS = Array.from({ length: 9 }, (_, i) => ((i % 3) + Math.abs(Math.floor(i / 3) - 1)) * 90);

/** Grade 3x3 de pontos piscando: indica trabalho em andamento. */
export function PixelDotsLoader({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("grid shrink-0 grid-cols-[repeat(3,3px)] items-center gap-[1.5px]", className)}>
      {DOT_DELAYS.map((delay, i) => (
        <span key={i} className="agent-pixel size-[3px] rounded-full bg-fg/80" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
  );
}

/** Texto com brilho deslizante, usado enquanto algo está em andamento. */
export function ShimmerText({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("agent-shimmer bg-clip-text font-medium text-transparent", className)}>{children}</span>;
}

export type TraceStatus = "running" | "done" | "failed";
export type TraceNode = {
  id: string | number;
  primary: string;
  secondary?: string;
  status: TraceStatus;
  icon?: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
};

function TracePillRow({ node }: { node: TraceNode }) {
  const Icon = node.icon ?? Command;
  return (
    <div className="agent-fade flex h-7 items-center gap-2 rounded-md px-1.5 text-[12.5px]">
      <span className="flex size-4 shrink-0 items-center justify-center">
        {node.status === "running" ? (
          <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-[1.5px] border-faint/40 border-t-fg" />
        ) : node.status === "failed" ? (
          <AlertCircle aria-hidden="true" className="size-3.5 text-danger" />
        ) : (
          <Icon aria-hidden="true" className={cn("size-3.5", node.iconClassName ?? "text-muted")} />
        )}
      </span>
      <span className={cn("shrink-0 font-medium", node.status === "failed" ? "text-danger" : "text-fg")}>
        {node.status === "running" ? <ShimmerText>{node.primary}</ShimmerText> : node.primary}
      </span>
      {node.secondary && (
        <span className="inline-flex h-5 min-w-0 items-center truncate rounded-md border border-border bg-surface-2 px-1.5 text-[11px] text-muted">
          <span className="truncate">{node.secondary}</span>
        </span>
      )}
      <span className="sr-only">{node.status === "running" ? "em andamento" : node.status === "failed" ? "falhou" : "concluída"}</span>
    </div>
  );
}

function formatDuration(ms: number) {
  const s = Math.max(1, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${s % 60}s`;
}

/** Hook: segundos decorridos desde `since`, atualizado enquanto `active`. */
function useElapsed(since: number | undefined, active: boolean) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [active]);
  return since ? Math.max(0, now - since) : 0;
}

export interface ThinkingStateProps {
  nodes: TraceNode[];
  /** Ainda trabalhando nesta sequência de etapas. */
  working: boolean;
  workingLabel?: string;
  /** Início do trabalho (ms), para o cronômetro ao vivo. */
  startedAt?: number;
  /** Duração final, quando já concluído. */
  durationMs?: number;
  className?: string;
}

/** Cabeçalho discreto "Trabalhando…" / "Trabalhou por Xs" com a linha do tempo das etapas. */
export function ThinkingState({ nodes, working, workingLabel = "Trabalhando…", startedAt, durationMs, className }: ThinkingStateProps) {
  const [manual, setManual] = React.useState<boolean | null>(null);
  const expanded = manual ?? working;
  const elapsed = useElapsed(startedAt, working);
  const failed = nodes.filter((n) => n.status === "failed").length;
  const finishedLabel = durationMs ? `Trabalhou por ${formatDuration(durationMs)}` : `${nodes.length} ${nodes.length === 1 ? "etapa" : "etapas"}`;
  const panelId = React.useId();

  return (
    <div className={cn("flex w-full flex-col text-fg", className)}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setManual(!expanded)}
        className="group flex w-fit items-center gap-1.5 rounded-sm text-left text-[13.5px] leading-relaxed text-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        {working && <PixelDotsLoader />}
        {working ? (
          <ShimmerText>
            {workingLabel}
            {startedAt ? <span className="ml-1.5 font-mono text-[11.5px] tabular-nums">{formatDuration(elapsed)}</span> : null}
          </ShimmerText>
        ) : (
          <span>
            {finishedLabel}
            {failed > 0 && <span className="text-danger"> · {failed} {failed === 1 ? "falha" : "falhas"}</span>}
          </span>
        )}
        <ChevronDown aria-hidden="true" className={cn("size-3 opacity-40 transition-transform duration-300 group-hover:opacity-80", expanded && "rotate-180")} />
      </button>

      <div id={panelId} className={cn("grid transition-[grid-template-rows,opacity] duration-300 ease-out", expanded ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0")}>
        <div className="min-h-0 overflow-hidden">
          <div className="ml-2 mt-1 flex flex-col gap-0.5 border-l border-border py-0.5 pl-2">
            {nodes.length === 0 ? (
              <div className="flex h-7 items-center px-1.5 text-[12.5px] text-faint">Lendo seu contexto…</div>
            ) : (
              nodes.map((node) => <TracePillRow key={node.id} node={node} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
