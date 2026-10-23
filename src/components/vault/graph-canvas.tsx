"use client";

import * as React from "react";
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-2d";
import { GRAPH_COLORS, graphNeighbors, matchesGraphNode, type GraphData, type GraphNode } from "./graph-model";

type CanvasNode = NodeObject<GraphNode>;
type CanvasLink = LinkObject<GraphNode>;

export type GraphControls = { fit: () => void; zoom: (factor: number) => void; reheat: () => void };
type Props = {
  data: GraphData;
  groups: string[];
  width: number;
  height: number;
  dark: boolean;
  query: string;
  hover: string | null;
  focused: string | null;
  labels: boolean;
  paused: boolean;
  nodeSize: number;
  controlsRef: React.RefObject<GraphControls | null>;
  onHover: (node: GraphNode | null) => void;
  onOpen: (id: string) => void;
  onFocus: (id: string) => void;
  onZoom: (zoom: number) => void;
};

function endId(endpoint: unknown): string | undefined {
  if (typeof endpoint === "string") return endpoint;
  if (endpoint && typeof endpoint === "object" && "id" in endpoint) return String(endpoint.id);
}

export default function GraphCanvas({ data, groups, width, height, dark, query, hover, focused, labels, paused, nodeSize, controlsRef, onHover, onOpen, onFocus, onZoom }: Props) {
  const ref = React.useRef<ForceGraphMethods<GraphNode> | undefined>(undefined);
  const fitted = React.useRef(false);
  const interacted = React.useRef(false);
  const labelBoxes = React.useRef<{ left: number; right: number; top: number; bottom: number }[]>([]);
  const visuals = React.useRef(new Map<string, { opacity: number; highlight: number }>());
  const lastFrame = React.useRef(0);
  const [redrawing, setRedrawing] = React.useState(false);
  // d3 mutates nodes and link endpoints. Keep the filtering model immutable.
  const graph = React.useMemo(() => ({ nodes: data.nodes.map((node) => ({ ...node })), links: data.links.map((link) => ({ ...link })) }), [data]);
  const neighbors = React.useMemo(() => graphNeighbors(data.links), [data.links]);
  const colors = React.useMemo(() => new Map(groups.map((group, index) => [group, GRAPH_COLORS[index % GRAPH_COLORS.length]])), [groups]);
  const matchingIds = React.useMemo(() => query.trim() ? new Set(data.nodes.filter((node) => matchesGraphNode(node, query)).map((node) => node.id)) : null, [data.nodes, query]);
  const active = hover ?? focused;
  React.useEffect(() => {
    // Redraw only for the fade, without reheating or moving the simulation.
    const frame = requestAnimationFrame(() => setRedrawing(true));
    const timer = window.setTimeout(() => setRedrawing(false), 600);
    return () => { window.clearTimeout(timer); cancelAnimationFrame(frame); };
  }, [active, matchingIds]);
  const fit = React.useCallback((duration = 350) => {
    const graph = ref.current;
    const bounds = graph?.getGraphBbox();
    // The engine can stop before new nodes receive coordinates when paused.
    if (!graph || !bounds || ![...bounds.x, ...bounds.y].every(Number.isFinite)) return false;
    graph.zoomToFit(duration, 55);
    return true;
  }, []);

  React.useImperativeHandle(controlsRef, () => ({
    fit: () => { fit(); },
    zoom: (factor) => {
      const graph = ref.current;
      if (graph) {
        const current = graph.zoom();
        graph.zoom(Math.min(8, Math.max(0.15, (Number.isFinite(current) ? current : 1) * factor)), 220);
      }
    },
    reheat: () => ref.current?.d3ReheatSimulation(),
  }), [fit]);

  React.useEffect(() => {
    fitted.current = false;
    interacted.current = false;
    const graph = ref.current;
    if (!graph) return;
    graph.d3Force("charge")?.strength?.(-170);
    graph.d3Force("link")?.distance?.(95);
    graph.d3ReheatSimulation();
    const timer = window.setTimeout(() => {
      if (!interacted.current) fit(450);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [graph, fit]);

  React.useEffect(() => {
    if (!paused) ref.current?.d3ReheatSimulation();
  }, [paused]);

  const nodeRadius = (node: GraphNode) => nodeSize * (2.2 + Math.min(Math.sqrt(node.degree) * 0.65, 5.5));
  const faded = (node: GraphNode) => Boolean((active && active !== node.id && !neighbors.get(active)?.has(node.id)) || (matchingIds && !matchingIds.has(node.id) && active !== node.id));

  return (
    <div onPointerDownCapture={() => { interacted.current = true; }} onWheelCapture={() => { interacted.current = true; }}>
    <ForceGraph2D<GraphNode>
      ref={ref}
      graphData={graph}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      autoPauseRedraw={!redrawing}
      onRenderFramePre={() => {
        labelBoxes.current = [];
        const now = performance.now();
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const blend = reduced ? 1 : 1 - Math.exp(-Math.min(now - lastFrame.current, 50) / 85);
        lastFrame.current = now;
        for (const node of graph.nodes) {
          const target = { opacity: faded(node) ? 0.14 : 1, highlight: active === node.id ? 1 : 0 };
          const previous = visuals.current.get(node.id) ?? { opacity: 1, highlight: 0 };
          visuals.current.set(node.id, { opacity: previous.opacity + (target.opacity - previous.opacity) * blend, highlight: previous.highlight + (target.highlight - previous.highlight) * blend });
        }
      }}
      minZoom={0.15}
      maxZoom={8}
      d3AlphaDecay={0.045}
      d3VelocityDecay={0.46}
      cooldownTicks={paused ? 0 : 160}
      cooldownTime={5000}
      warmupTicks={35}
      nodeLabel={() => ""}
      nodeRelSize={4}
      enableNodeDrag
      enablePanInteraction
      enableZoomInteraction
      linkCanvasObject={(link: CanvasLink, ctx) => {
        const source = link.source as CanvasNode;
        const target = link.target as CanvasNode;
        if (source.x === undefined || source.y === undefined || target.x === undefined || target.y === undefined) return;
        const a = visuals.current.get(endId(source) ?? "");
        const b = visuals.current.get(endId(target) ?? "");
        const highlight = Math.max(a?.highlight ?? 0, b?.highlight ?? 0);
        const opacity = Math.min(a?.opacity ?? 1, b?.opacity ?? 1);
        ctx.beginPath(); ctx.moveTo(source.x, source.y); ctx.lineTo(target.x, target.y);
        ctx.lineWidth = 0.4 + highlight * 0.6;
        ctx.strokeStyle = `rgba(${dark ? "167,139,250" : "109,76,189"},${0.12 * opacity + highlight * 0.5})`;
        ctx.stroke();
      }}
      onNodeHover={(node) => onHover(node ?? null)}
      onNodeClick={(node) => onOpen(node.id)}
      onNodeRightClick={(node, event) => { event.preventDefault(); onFocus(node.id); }}
      onNodeDrag={() => { interacted.current = true; }}
      onNodeDragEnd={(node) => { node.fx = node.x; node.fy = node.y; }}
      onZoomEnd={({ k }) => { if (Number.isFinite(k) && k > 0) onZoom(k); }}
      onBackgroundClick={() => onHover(null)}
      onEngineStop={() => {
        if (!fitted.current && !interacted.current) {
          fitted.current = fit(450);
        }
      }}
      nodePointerAreaPaint={(node: CanvasNode, color, ctx, scale) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(node.x ?? 0, node.y ?? 0, Math.max(nodeRadius(node), 8 / scale), 0, Math.PI * 2);
        ctx.fill();
      }}
      nodeCanvasObject={(node: CanvasNode, ctx, scale) => {
        const x = node.x ?? 0;
        const y = node.y ?? 0;
        const radius = nodeRadius(node);
        const color = colors.get(node.group) ?? GRAPH_COLORS[0];
        const isActive = active === node.id;
        const isMatch = Boolean(matchingIds?.has(node.id));
        const visual = visuals.current.get(node.id) ?? { opacity: 1, highlight: 0 };
        ctx.save();
        ctx.globalAlpha = visual.opacity;
        if (visual.highlight > 0.01 || isMatch) {
          ctx.globalAlpha = visual.opacity * (isMatch ? 1 : visual.highlight);
          ctx.beginPath();
          ctx.arc(x, y, radius + 5 / scale, 0, Math.PI * 2);
          ctx.fillStyle = dark ? "rgba(167,139,250,0.12)" : "rgba(109,76,189,0.10)";
          ctx.fill();
          ctx.lineWidth = 1 / scale;
          ctx.strokeStyle = color;
          ctx.stroke();
          ctx.globalAlpha = visual.opacity;
        }
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        if (node.degree === 0) { ctx.lineWidth = 1 / scale; ctx.strokeStyle = color; ctx.stroke(); } else ctx.fill();
        if ((labels && (scale > 2.5 || (!active && scale > 1.4 && node.degree >= 20))) || visual.highlight > 0.02 || isMatch) {
          ctx.globalAlpha = visual.opacity * (isMatch || labels && scale > 2.5 || !active && labels && scale > 1.4 && node.degree >= 20 ? 1 : visual.highlight);
          const fontSize = 10 / Math.sqrt(Math.max(scale, 0.7));
          const title = node.name.length > 44 ? `${node.name.slice(0, 43)}…` : node.name;
          ctx.font = `${isActive ? "600 " : ""}${fontSize}px system-ui, sans-serif`;
          const halfWidth = ctx.measureText(title).width / 2 + 3 / scale;
          const top = y + radius + 4 / scale;
          const box = { left: x - halfWidth, right: x + halfWidth, top, bottom: top + fontSize + 3 / scale };
          // Keep hubs readable at rest and always preserve the hovered title.
          const overlaps = labelBoxes.current.some((other) => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top);
          if (overlaps && !isActive) { ctx.restore(); return; }
          labelBoxes.current.push(box);
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.lineWidth = 3 / scale;
          ctx.strokeStyle = dark ? "#171719" : "#fafafa";
          ctx.strokeText(title, x, y + radius + 4 / scale);
          ctx.fillStyle = dark ? "#dce1ed" : "#384257";
          ctx.fillText(title, x, y + radius + 4 / scale);
        }
        ctx.restore();
      }}
    />
    </div>
  );
}
