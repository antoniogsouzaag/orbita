import { describe, expect, it } from "vitest";
import { filterGraph, graphNeighborhood, graphNeighbors, matchesGraphNode, prepareGraph, vaultNoteHref, type GraphData } from "@/components/vault/graph-model";

const data: GraphData = {
  nodes: [
    { id: "Empresa/Visão.md", name: "Visão da AG LABS", group: "Empresa", degree: 99, tags: ["estratégia"] },
    { id: "Empresa/Plano.md", name: "Plano de execução", group: "Empresa", degree: 99 },
    { id: "Pessoal/Foco.md", name: "Foco", group: "Pessoal", degree: 99 },
    { id: "Pessoal/Leitura.md", name: "Leitura", group: "Pessoal", degree: 99 },
  ],
  links: [
    { source: "Empresa/Visão.md", target: "Empresa/Plano.md" },
    { source: "Empresa/Plano.md", target: "Empresa/Visão.md" },
    { source: "Empresa/Plano.md", target: "Pessoal/Foco.md" },
    { source: "Empresa/Visão.md", target: "Empresa/Visão.md" },
    { source: "Empresa/Plano.md", target: "Não existe.md" },
  ],
};

describe("vault graph", () => {
  it("deduplicates reciprocal links, drops missing/self endpoints and counts unique neighbors", () => {
    const graph = prepareGraph(data);
    expect(graph.links).toHaveLength(2);
    expect(graph.nodes.map((node) => node.degree)).toEqual([1, 2, 1, 0]);
    expect(data.nodes[0].degree).toBe(99);
  });

  it("bounds neighborhood traversal by depth, including isolated notes", () => {
    const neighbors = graphNeighbors(prepareGraph(data).links);
    expect([...graphNeighborhood(neighbors, "Empresa/Visão.md", 1)]).toEqual(["Empresa/Visão.md", "Empresa/Plano.md"]);
    expect([...graphNeighborhood(neighbors, "Empresa/Visão.md", 2)]).toEqual(["Empresa/Visão.md", "Empresa/Plano.md", "Pessoal/Foco.md"]);
    expect([...graphNeighborhood(neighbors, "Pessoal/Leitura.md", 2)]).toEqual(["Pessoal/Leitura.md"]);
  });

  it("searches accent-insensitive titles, paths and tags and requires every term", () => {
    expect(matchesGraphNode(data.nodes[0], "visao #estrategia")).toBe(true);
    expect(matchesGraphNode(data.nodes[0], "empresa ag labs")).toBe(true);
    expect(matchesGraphNode(data.nodes[0], "visao leitura")).toBe(false);
  });

  it("filters notes and edges together without dangling endpoints", () => {
    const graph = prepareGraph(data);
    const filtered = filterGraph(graph, { group: "Empresa", connectedOnly: true });
    expect(filtered.nodes).toHaveLength(2);
    expect(filtered.links).toHaveLength(1);
    expect(filterGraph(graph, { group: "Pessoal", connectedOnly: true }).nodes.map((node) => node.name)).toEqual(["Foco"]);
    expect(filterGraph(graph, { group: null, connectedOnly: false, neighborhood: new Set(["Pessoal/Leitura.md"]) }).links).toEqual([]);
  });

  it("opens the actual vault path with reserved characters encoded", () => {
    expect(vaultNoteHref("Pessoal/Plano #1 & ação.md")).toBe("/vault?p=Pessoal%2FPlano%20%231%20%26%20a%C3%A7%C3%A3o.md");
  });
});
