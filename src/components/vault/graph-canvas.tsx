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
  // d3 mutates nodes and link endpoints. Keep the filtering model immutable.
  const graph = React.useMemo(() => ({ nodes: data.nodes.map((node) => ({ ...node })), links: data.links.map((link) => ({ ...link })) }), [data]);
  const neighbors = React.useMemo(() => graphNeighbors(data.links), [data.links]);
  const colors = React.useMemo(() => new Map(groups.map((group, index) => [group, GRAPH_COLORS[index % GRAPH_COLORS.length]])), [groups]);
  const matchingIds = React.useMemo(() => query.trim() ? new Set(data.nodes.filter((node) => matchesGraphNode(node, query)).map((node) => node.id)) : null, [data.nodes, query]);
  const active = hover ?? focused;
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
      onRenderFramePre={() => { labelBoxes.current = []; }}
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
      linkColor={(link: CanvasLink) => {
        const connected = active && (endId(link.source) === active || endId(link.target) === active);
        return connected ? (dark ? "rgba(167,139,250,0.65)" : "rgba(109,76,189,0.62)") : active ? (dark ? "rgba(150,160,180,0.07)" : "rgba(80,90,110,0.07)") : dark ? "rgba(158,170,192,0.11)" : "rgba(95,105,125,0.13)";
      }}
      linkWidth={(link: CanvasLink) => active && (endId(link.source) === active || endId(link.target) === active) ? 1 : 0.4}
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
        const isNeighbor = Boolean(active && neighbors.get(active)?.has(node.id));
        const isMatch = Boolean(matchingIds?.has(node.id));
        ctx.save();
        ctx.globalAlpha = faded(node) ? 0.14 : 1;
        if (isActive || isMatch) {
          ctx.beginPath();
          ctx.arc(x, y, radius + 5 / scale, 0, Math.PI * 2);
          ctx.fillStyle = dark ? "rgba(167,139,250,0.12)" : "rgba(109,76,189,0.10)";
          ctx.fill();
          ctx.lineWidth = 1 / scale;
          ctx.strokeStyle = color;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? (dark ? "#f0ecff" : "#5f42a8") : color;
        if (node.degree === 0) { ctx.lineWidth = 1 / scale; ctx.strokeStyle = color; ctx.stroke(); } else ctx.fill();
        if (!faded(node) && ((labels && (scale > 2.5 || (scale > 0.85 && node.degree >= 20))) || isActive || isMatch || isNeighbor)) {
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
