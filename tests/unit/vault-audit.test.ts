import { describe, expect, it } from "vitest";
import { auditVault } from "@/lib/vault-audit";

describe("revisão do vault", () => {
  it("distingue isoladas, referências ausentes, metadados e títulos ambíguos", () => {
    const note = (path: string, title: string, links: string[] = [], unresolved: string[] = []) => ({ path, title, links, unresolved, frontmatter: {} });
    const audit = auditVault([note("a.md", "Início", ["b.md"], ["Faltando"]), note("b.md", "Inicio"), note("c.md", "Isolada"), note("Templates/modelo.md", "Modelo")]);
    expect(audit.orphans).toEqual(["c.md", "Templates/modelo.md"]);
    expect(audit.broken).toEqual([{ path: "a.md", targets: ["Faltando"] }]);
    expect(audit.metadata).not.toContain("Templates/modelo.md");
    expect(audit.duplicates).toEqual([["a.md", "b.md"]]);
  });
});
