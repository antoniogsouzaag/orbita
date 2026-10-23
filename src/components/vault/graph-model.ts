import { normalize } from "@/lib/text";

export type GraphNode = { id: string; name: string; group: string; degree: number; tags?: string[] };
export type GraphLink = { source: string; target: string };
export type GraphData = { nodes: GraphNode[]; links: GraphLink[] };
export const GRAPH_COLORS = ["#a78bfa", "#5cc8c8", "#e5b76c", "#80c799", "#dc8d9d", "#7aa9e8", "#c698d6", "#a9c474", "#93a7ba", "#d4c18a"];

/** Reciprocal wikilinks represent one visual relationship and one neighbor. */
export function prepareGraph(data: GraphData): GraphData {
  const ids = new Set(data.nodes.map((node) => node.id));
  const seen = new Set<string>();
  const links = data.links.filter(({ source, target }) => {
    if (source === target || !ids.has(source) || !ids.has(target)) return false;
    const key = JSON.stringify([source, target].sort());
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const neighbors = graphNeighbors(links);
  return { nodes: data.nodes.map((node) => ({ ...node, degree: neighbors.get(node.id)?.size ?? 0 })), links };
}

export function graphNeighbors(links: GraphLink[]) {
  const neighbors = new Map<string, Set<string>>();
  for (const { source, target } of links) {
    if (!neighbors.has(source)) neighbors.set(source, new Set());
    if (!neighbors.has(target)) neighbors.set(target, new Set());
    neighbors.get(source)!.add(target);
    neighbors.get(target)!.add(source);
  }
  return neighbors;
}

export function graphNeighborhood(neighbors: Map<string, Set<string>>, id: string, depth: number) {
  const visited = new Set([id]);
  let frontier = [id];
  for (let step = 0; step < depth; step++) {
    const next: string[] = [];
    for (const node of frontier) for (const neighbor of neighbors.get(node) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        next.push(neighbor);
      }
    }
    frontier = next;
  }
  return visited;
}

export function matchesGraphNode(node: GraphNode, query: string) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const text = normalize([node.name, node.id, ...(node.tags ?? [])].join(" "));
  return terms.every((term) => text.includes(term.replace(/^#/, "")));
}

export function filterGraph(data: GraphData, options: { group: string | null; connectedOnly: boolean; neighborhood?: Set<string> }): GraphData {
  const nodes = data.nodes.filter((node) =>
    (options.group === null || node.group === options.group) &&
    (!options.connectedOnly || node.degree > 0) &&
    (!options.neighborhood || options.neighborhood.has(node.id)),
  );
  const ids = new Set(nodes.map((node) => node.id));
  return { nodes, links: data.links.filter((link) => ids.has(link.source) && ids.has(link.target)) };
}

export function vaultNoteHref(path: string) {
  return `/vault?p=${encodeURIComponent(path)}`;
}
