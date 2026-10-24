import { describe, expect, it } from "vitest";
import { canonicalAgentId, composeTeam, type TeamSources } from "@/lib/team";

const entry = (name: string) => ({ name, emoji: "🤖", area: "", role: "", status: "ativo", path: `03 - Equipe e Agentes/Agente - ${name}.md` });
const at = new Date("2026-10-24T12:00:00Z");
const sources = (over: Partial<TeamSources> = {}): TeamSources => ({
  registry: ["Tom", "Mark", "Hermes EasyPanel", "Hermes Oracle", "Hermes Maia"].map(entry),
  tokens: [
    { name: "Hermes Oracle", revoked: false, lastUsedAt: at, scopes: ["admin", "contexto"] },
    { name: "Tom", revoked: false, lastUsedAt: null, scopes: ["contexto"] },
    { name: "Claude Code", revoked: false, lastUsedAt: null, scopes: ["contexto"] },
  ],
  activity: [{ agent: "Hermes Oracle", summary: "registrou evento", createdAt: at }],
  summary: { rows: [{ agent: "Hermes Oracle", calls: 3, failures: 1 }] },
  avatars: new Map(),
  ...over,
});

describe("time e diretoria", () => {
  it("apelidos antigos levam ao id da ficha do vault", () => {
    expect(canonicalAgentId("oracle")).toBe("hermes-oracle");
    expect(canonicalAgentId("Oracle")).toBe("hermes-oracle");
    expect(canonicalAgentId("Hermes Oracle")).toBe("hermes-oracle");
    expect(canonicalAgentId("hermes-easy")).toBe("hermes-easypanel");
    expect(canonicalAgentId("Mark")).toBe("mark");
  });

  it("mostra cada diretor uma vez, com integração e dados do acesso MCP no mesmo card", () => {
    const team = composeTeam(sources());
    const ids = team.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain("oracle");
    expect(team.slice(0, 3).map((m) => [m.id, m.director])).toEqual([["tom", "tom"], ["hermes-oracle", "oracle"], ["hermes-easypanel", "easypanel"]]);
    const oracle = team.find((m) => m.id === "hermes-oracle")!;
    expect(oracle).toMatchObject({ name: "Hermes Oracle", runtime: "Hermes · VPS-03", calls: 3, failures: 1, lastMessage: "registrou evento", scopes: ["admin", "contexto"] });
    expect(oracle.path).toContain("Hermes Oracle");
    expect(team.find((m) => m.id === "hermes-maia")?.director).toBeNull();
    expect(team.at(-1)).toMatchObject({ id: "claude-code", director: null });
  });

  it("diretor ausente do registro ainda aparece uma vez", () => {
    const team = composeTeam(sources({ registry: [entry("Mark")] }));
    expect(team.filter((m) => m.director).map((m) => m.id)).toEqual(["tom", "hermes-oracle", "hermes-easypanel"]);
    expect(team.filter((m) => m.id === "hermes-oracle")).toHaveLength(1);
  });

  it("usa a foto do id antigo só enquanto não houver foto no id canônico", () => {
    const legacy = composeTeam(sources({ avatars: new Map([["oracle", "/api/agents/oracle/avatar?v=1"]]) }));
    expect(legacy.find((m) => m.id === "hermes-oracle")?.avatar).toBe("/api/agents/oracle/avatar?v=1");
    for (const order of [[["oracle", "a"], ["hermes-oracle", "b"]], [["hermes-oracle", "b"], ["oracle", "a"]]] as [string, string][][]) {
      expect(composeTeam(sources({ avatars: new Map(order) })).find((m) => m.id === "hermes-oracle")?.avatar).toBe("b");
    }
  });
});
