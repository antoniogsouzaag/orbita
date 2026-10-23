"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import * as React from "react";
import { Input } from "@/components/ui/input";

const ForceGraph2D = dynamic(() => import("./graph-canvas"), { ssr: false });

export type GraphData = { nodes: { id: string; name: string; group: string; degree: number }[]; links: { source: string; target: string }[] };

function endId(e: unknown): string | undefined {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "id" in e) return String((e as { id: unknown }).id);
  return undefined;
}

const COLORS = ["#22d3ee", "#a78bfa", "#f59e0b", "#22c55e", "#fb7185", "#3b82f6", "#f472b6", "#84cc16", "#94a3b8", "#eab308"];

export function VaultGraph({ data }: { data: GraphData }) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const ref = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ w: 800, h: 600 });
  const [hover, setHover] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const groups = React.useMemo(() => [...new Set(data.nodes.map((n) => n.group))], [data.nodes]);
  const neighbors = React.useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of data.links) {
      if (!m.has(l.source)) m.set(l.source, new Set());
      if (!m.has(l.target)) m.set(l.target, new Set());
      m.get(l.source)!.add(l.target);
      m.get(l.target)!.add(l.source);
    }
    return m;
  }, [data.links]);
  const graph = React.useMemo(() => ({ nodes: data.nodes.map((n) => ({ ...n })), links: data.links.map((l) => ({ ...l })) }), [data]);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dark = resolvedTheme !== "light";
  const match = q.trim().toLowerCase();
  return (
    <div className="relative">
      <div className="absolute left-3 top-3 z-10 w-64"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Destacar notas…" className="h-9 bg-surface/90 backdrop-blur" /></div>
      <div className="absolute bottom-3 left-3 z-10 flex max-w-[90%] flex-wrap gap-x-3 gap-y-1 rounded-xl bg-surface/80 px-3 py-2 text-[11px] text-muted backdrop-blur">
        {groups.map((g, i) => <span key={g} className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{g || "raiz"}</span>)}
      </div>
      <div ref={ref} className="h-[calc(100dvh-190px)] min-h-[420px] w-full overflow-hidden rounded-2xl border border-border bg-surface">
        <ForceGraph2D
          graphData={graph}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          nodeRelSize={4}
          cooldownTicks={120}
          linkColor={(l: { source?: unknown; target?: unknown }) => {
            const s = endId(l.source);
            const t = endId(l.target);
            return hover && (s === hover || t === hover) ? "rgba(34,211,238,0.8)" : dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.12)";
          }}
          linkWidth={(l: { source?: unknown; target?: unknown }) => {
            const s = endId(l.source);
            const t = endId(l.target);
            return hover && (s === hover || t === hover) ? 1.6 : 0.6;
          }}
          onNodeHover={(n: { id?: string | number } | null) => setHover(n ? String(n.id) : null)}
          onNodeClick={(n: { id?: string | number }) => router.push(`/vault?p=${encodeURIComponent(String(n.id))}`)}
          nodeCanvasObject={(node: { id?: string | number; name?: string; group?: string; degree?: number; x?: number; y?: number }, ctx: CanvasRenderingContext2D, scale: number) => {
            const id = String(node.id);
            const r = 2.5 + Math.sqrt(node.degree ?? 0) * 1.6;
            const faded = (hover && hover !== id && !neighbors.get(hover)?.has(id)) || (match && !String(node.name).toLowerCase().includes(match));
            const color = COLORS[groups.indexOf(node.group ?? "") % COLORS.length];
            ctx.globalAlpha = faded ? 0.15 : 1;
            ctx.beginPath();
            ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
            if (scale > 1.4 || hover === id || (match && !faded)) {
              ctx.font = `${11 / scale}px Inter, sans-serif`;
              ctx.textAlign = "center";
              ctx.fillStyle = dark ? "#e5e5e5" : "#222";
              ctx.fillText(String(node.name), node.x ?? 0, (node.y ?? 0) + r + 9 / scale);
            }
            ctx.globalAlpha = 1;
          }}
        />
      </div>
    </div>
  );
}
