"use client";

import { ArrowUpRight, Crosshair, Filter, Focus, List, Maximize2, Minimize2, Minus, Network, Pause, Play, RotateCcw, Search, Tags, X, ZoomIn } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { GraphControls } from "./graph-canvas";
import { GRAPH_COLORS, filterGraph, graphNeighborhood, graphNeighbors, matchesGraphNode, prepareGraph, vaultNoteHref, type GraphData, type GraphNode } from "./graph-model";

export type { GraphData } from "./graph-model";

const GraphCanvas = dynamic(() => import("./graph-canvas"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center gap-2 text-sm text-muted"><Network className="size-4 animate-pulse" /> Preparando conexões…</div>,
});

export function VaultGraph({ data }: { data: GraphData }) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const controlsRef = React.useRef<GraphControls | null>(null);
  const [size, setSize] = React.useState({ width: 800, height: 600 });
  const [hover, setHover] = React.useState<GraphNode | null>(null);
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query);
  const [group, setGroup] = React.useState<string | null>(null);
  const [connectedOnly, setConnectedOnly] = React.useState(false);
  const [focused, setFocused] = React.useState<string | null>(null);
  const [depth, setDepth] = React.useState(1);
  const [labels, setLabels] = React.useState(true);
  const [nodeSize, setNodeSize] = React.useState(1);
  const [paused, setPaused] = React.useState(false);
  const [explorerOpen, setExplorerOpen] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [zoom, setZoom] = React.useState(1);
  const graph = React.useMemo(() => prepareGraph(data), [data]);
  const groups = React.useMemo(() => [...new Set(graph.nodes.map((node) => node.group))].sort((a, b) => a.localeCompare(b, "pt-BR")), [graph.nodes]);
  const neighbors = React.useMemo(() => graphNeighbors(graph.links), [graph.links]);
  const neighborhood = React.useMemo(() => focused ? graphNeighborhood(neighbors, focused, depth) : undefined, [neighbors, focused, depth]);
  const visible = React.useMemo(() => filterGraph(graph, { group, connectedOnly, neighborhood }), [graph, group, connectedOnly, neighborhood]);
  const matches = React.useMemo(() => visible.nodes.filter((node) => matchesGraphNode(node, deferredQuery)).sort((a, b) => b.degree - a.degree || a.name.localeCompare(b.name, "pt-BR")), [visible.nodes, deferredQuery]);
  const focusedNode = graph.nodes.find((node) => node.id === focused);
  const detail = hover ?? focusedNode;
  const hasFilters = group !== null || connectedOnly || focused !== null || Boolean(query.trim());
  const dark = resolvedTheme !== "light";

  React.useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function focusNode(id: string) {
    setFocused(id);
    setHover(null);
    setGroup(null);
    setConnectedOnly(false);
    setExplorerOpen(false);
  }

  function reset() {
    setQuery("");
    setGroup(null);
    setConnectedOnly(false);
    setFocused(null);
    setHover(null);
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await containerRef.current?.requestFullscreen?.().catch(() => undefined);
  }

  return (
    <div ref={containerRef} className={cn("flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm", fullscreen ? "h-dvh rounded-none" : "h-[calc(100dvh-185px)] min-h-[560px] sm:min-h-[590px]")}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface/95 p-3">
        <div className="relative min-w-[150px] flex-1 sm:max-w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input value={query} onChange={(event) => { setQuery(event.target.value); setExplorerOpen(true); }} aria-label="Buscar notas no grafo" placeholder="Buscar nota, pasta ou #tag…" className="h-9 pl-9 pr-8" />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-fg"><X className="size-3.5" /></button>}
        </div>
        <Select aria-label="Filtrar grafo por pasta" value={group === null ? "all" : `folder:${group}`} onChange={(event) => { setGroup(event.target.value === "all" ? null : event.target.value.slice(7)); setHover(null); }} className="h-9 w-[145px] sm:w-[170px]">
          <option value="all">Todas as pastas</option>
          {groups.map((name) => <option key={name} value={`folder:${name}`}>{name || "Raiz do vault"}</option>)}
        </Select>
        <Button size="sm" variant={connectedOnly ? "secondary" : "ghost"} aria-label="Mostrar somente notas conectadas" aria-pressed={connectedOnly} onClick={() => { setConnectedOnly(!connectedOnly); setHover(null); }} title="Ocultar notas sem conexões" className="h-9"><Filter /><span className="hidden sm:inline">Conectadas</span></Button>
        <Button size="sm" variant="ghost" aria-label="Mostrar títulos das notas" aria-pressed={labels} onClick={() => setLabels(!labels)} title={labels ? "Ocultar títulos" : "Mostrar títulos"} className="h-9"><Tags /><span className="hidden xl:inline">Títulos</span></Button>
        <label className="flex items-center gap-2 px-1 text-[11px] text-muted">Nós<input type="range" aria-label="Tamanho dos nós" min="0.5" max="1.8" step="0.1" value={nodeSize} onChange={(event) => setNodeSize(Number(event.target.value))} className="w-20 accent-[var(--accent)]" /></label>
        <div className="ml-auto flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label={explorerOpen ? "Ocultar explorador de notas" : "Mostrar explorador de notas"} aria-expanded={explorerOpen} aria-controls="vault-graph-explorer" onClick={() => setExplorerOpen(!explorerOpen)} className="lg:hidden"><List /></Button>
          <Button size="icon" variant="ghost" aria-label={fullscreen ? "Sair da tela cheia" : "Abrir grafo em tela cheia"} onClick={toggleFullscreen}>{fullscreen ? <Minimize2 /> : <Maximize2 />}</Button>
        </div>
      </div>

      {focusedNode && <div className="flex flex-wrap items-center gap-2 border-b border-accent/15 bg-accent/5 px-3 py-2 text-xs">
        <Focus className="size-3.5 text-accent" /><span className="min-w-0 max-w-[40%] truncate font-medium" title={focusedNode.name}>{focusedNode.name}</span>
        <Select value={depth} onChange={(event) => setDepth(Number(event.target.value))} aria-label="Profundidade da vizinhança" className="h-7 w-36 text-xs"><option value={1}>Conexões diretas</option><option value={2}>Até 2 conexões</option></Select>
        <Button size="icon-sm" variant="ghost" aria-label="Voltar ao grafo completo" onClick={() => { setFocused(null); setHover(null); }} className="ml-auto"><X /></Button>
      </div>}

      <div className="relative flex min-h-0 flex-1">
        <div ref={canvasRef} className="relative min-w-0 flex-1 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40" style={{ backgroundColor: dark ? "#171719" : "#fafafa" }} role="region" aria-label="Mapa interativo de notas do vault" aria-describedby="vault-graph-help" tabIndex={0}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "+" || event.key === "=") { event.preventDefault(); controlsRef.current?.zoom(1.35); }
            if (event.key === "-") { event.preventDefault(); controlsRef.current?.zoom(1 / 1.35); }
            if (event.key === "0") { event.preventDefault(); controlsRef.current?.fit(); }
            if (event.key === "Escape") { setFocused(null); setHover(null); }
          }}>
          {visible.nodes.length ? <GraphCanvas data={visible} groups={groups} width={size.width} height={size.height} dark={dark} query={deferredQuery} hover={hover?.id ?? null} focused={focused} labels={labels} paused={paused} nodeSize={nodeSize} controlsRef={controlsRef} onHover={setHover} onOpen={(id) => router.push(vaultNoteHref(id))} onFocus={focusNode} onZoom={setZoom} /> : <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-5 text-center"><Network className="size-8 text-faint" /><p className="text-sm text-muted">Nenhuma nota nesta visualização.</p>{hasFilters && <Button size="sm" onClick={reset}>Limpar filtros</Button>}</div>}
          <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-border/60 bg-surface/85 px-3 py-2 text-[11px] text-muted shadow-sm backdrop-blur-md" aria-live="polite"><span className="font-semibold text-fg">{visible.nodes.length}</span> notas <span className="px-1 text-faint">/</span> {graph.nodes.length} <span className="mx-2 text-faint">·</span>{visible.links.length} conexões</div>
          {detail && <div className="pointer-events-none absolute bottom-16 left-3 max-w-[calc(100%-24px)] rounded-xl border border-border bg-surface/95 px-3 py-2 shadow-lg backdrop-blur sm:max-w-80"><p className="truncate text-sm font-medium">{detail.name}</p><p className="mt-0.5 truncate text-[11px] text-muted">{detail.id}</p><p className="mt-1 text-[11px] text-faint">{detail.degree} notas conectadas · clique para abrir</p></div>}
          <div className="absolute bottom-3 left-3 flex items-center gap-0.5 rounded-xl border border-border bg-surface/95 p-1 shadow-lg backdrop-blur-md">
            <Button size="icon" variant="ghost" aria-label="Diminuir zoom" onClick={() => controlsRef.current?.zoom(1 / 1.35)}><Minus /></Button>
            <span className="w-11 text-center text-[11px] tabular-nums text-muted">{Math.round(zoom * 100)}%</span>
            <Button size="icon" variant="ghost" aria-label="Aumentar zoom" onClick={() => controlsRef.current?.zoom(1.35)}><ZoomIn /></Button>
            <span className="mx-1 h-5 w-px bg-border" />
            <Button size="icon" variant="ghost" aria-label="Enquadrar todas as notas" title="Enquadrar (0)" onClick={() => controlsRef.current?.fit()}><Crosshair /></Button>
            <Button size="icon" variant="ghost" aria-label={paused ? "Retomar movimento" : "Pausar movimento"} aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? <Play /> : <Pause />}</Button>
            <Button size="icon" variant="ghost" aria-label="Reorganizar grafo" title="Reorganizar grafo" onClick={() => { setPaused(false); controlsRef.current?.reheat(); }}><RotateCcw /></Button>
          </div>
        </div>

        <aside id="vault-graph-explorer" aria-label="Explorador de notas do grafo" className={cn("z-10 flex w-[280px] shrink-0 flex-col border-l border-border bg-surface/95 backdrop-blur-xl", explorerOpen ? "absolute inset-y-0 right-0 max-w-[85%] shadow-xl lg:static lg:shadow-none" : "hidden lg:flex")}>
          <div className="flex items-center justify-between border-b border-border p-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{query.trim() ? "Resultados" : "Explorar conexões"}</p><p className="mt-1 text-xs text-muted" aria-live="polite">{query.trim() ? `${matches.length} notas encontradas` : "Notas mais conectadas primeiro"}</p></div><Button size="icon-sm" variant="ghost" onClick={() => setExplorerOpen(false)} aria-label="Fechar explorador" className="lg:hidden"><X /></Button></div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {matches.length === 0 ? <p className="px-2 py-5 text-xs leading-relaxed text-muted">Nenhuma nota encontrada. Tente outro título, pasta ou tag.</p> : <ul className="space-y-1">{matches.map((node) => <li key={node.id} className={cn("group flex items-center gap-1 rounded-xl px-2 py-1.5 transition-colors hover:bg-surface-2", focused === node.id && "bg-accent/8")}>
              <Link href={vaultNoteHref(node.id)} prefetch={false} className="min-w-0 flex-1 rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" title={`Abrir ${node.name}`} onMouseEnter={() => setHover(node)} onMouseLeave={() => setHover(null)}>
                <span className="flex items-center gap-2 text-[12.5px] font-medium"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: GRAPH_COLORS[groups.indexOf(node.group) % GRAPH_COLORS.length] }} /><span className="truncate">{node.name}</span></span><span className="mt-1 block truncate pl-4 text-[10.5px] text-faint">{node.group || "Raiz"} · {node.degree} conexões</span>
              </Link>
              <Button size="icon-sm" variant="ghost" onClick={() => focusNode(node.id)} aria-label={`Focar nas conexões de ${node.name}`} title="Focar nesta nota"><Focus /></Button>
              <Link href={vaultNoteHref(node.id)} prefetch={false} aria-label={`Abrir nota ${node.name}`} title="Abrir nota" className="rounded-lg p-1.5 text-faint hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"><ArrowUpRight className="size-3.5" /></Link>
            </li>)}</ul>}
          </div>
          <div className="border-t border-border p-3"><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-faint">Pastas</p><div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">{groups.map((name, index) => <button key={name} type="button" aria-pressed={group === name} onClick={() => { setGroup(group === name ? null : name); setHover(null); }} className={cn("flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40", group === name ? "border-accent/40 bg-accent/8 text-fg" : "border-border text-muted hover:bg-surface-2")}><span className="size-1.5 rounded-full" style={{ backgroundColor: GRAPH_COLORS[index % GRAPH_COLORS.length] }} />{name || "Raiz"}</button>)}</div></div>
        </aside>
      </div>
      <div className="flex items-center gap-2 border-t border-border bg-surface px-3 py-2">
        <p id="vault-graph-help" className="flex-1 text-[10.5px] leading-relaxed text-faint"><span className="hidden sm:inline">Arraste para mover · role para ampliar · </span>Clique abre a nota · <span className="hidden sm:inline">botão direito ou </span>ícone de foco mostra vizinhos<span className="hidden xl:inline"> · teclado: + / − / 0 / Esc</span></p>
        {hasFilters && <button type="button" onClick={reset} className="shrink-0 rounded px-1 py-0.5 text-[11px] text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">Limpar filtros</button>}
      </div>
    </div>
  );
}
