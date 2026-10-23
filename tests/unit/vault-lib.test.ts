import { describe, expect, it } from "vitest";
import { firstUrl, firstWikiTarget, parseTables, plainText } from "@/lib/md-tables";
import { createResolver, extractTags, extractWikiLinks } from "@/lib/wikilinks";

describe("wikilinks", () => {
  it("extrai alvo, seção, apelido e embeds (inclusive \\| em tabelas)", () => {
    const links = extractWikiLinks("Veja [[Nota A]], [[Pasta/Nota B#Seção|apelido]], ![[img.png]] e [[Página - X\\|X]]");
    expect(links.map((l) => [l.target, l.heading, l.alias, l.embed])).toEqual([
      ["Nota A", undefined, undefined, false],
      ["Pasta/Nota B", "Seção", "apelido", false],
      ["img.png", undefined, undefined, true],
      ["Página - X", undefined, "X", false],
    ]);
  });
  it("resolve por nome sem caixa/acento e prefere caminho mais curto", () => {
    const r = createResolver(["01 - Empresa/Identidade da AG LABS.md", "a/b/Registro.md", "Registro.md"]);
    expect(r("identidade da ag labs")).toBe("01 - Empresa/Identidade da AG LABS.md");
    expect(r("Registro")).toBe("Registro.md");
    expect(r("a/b/Registro")).toBe("a/b/Registro.md");
    expect(r("Inexistente")).toBeNull();
  });
  it("tags ignoram títulos e código", () => {
    expect(extractTags("# Título\ntexto #ops e #infra/vps `#nao`\n```\n#codigo\n```")).toEqual(["ops", "infra/vps"]);
  });
});

describe("tabelas markdown", () => {
  const md = `# Doc\n## P1 — Receita\n| Endereço | O que é |\n|---|---|\n| https://a.com/ | SaaS |\n| [b](https://b.com) | Site \\| cliente |\n\n## P2\n| Agente | Área |\n|---|---|\n| [[Agente - Tom]] 🦾 | Liderança |\n`;
  it("encontra tabelas com a trilha de títulos", () => {
    const t = parseTables(md);
    expect(t).toHaveLength(2);
    expect(t[0].headings).toEqual(["Doc", "P1 — Receita"]);
    expect(t[0].rows[1][1]).toBe("Site \\| cliente");
    expect(plainText(t[0].rows[1][1])).toBe("Site | cliente");
    expect(firstUrl(t[0].rows[0][0])).toBe("https://a.com/");
    expect(firstUrl(t[0].rows[1][0])).toBe("https://b.com");
    expect(firstWikiTarget(t[1].rows[0][0])).toBe("Agente - Tom");
    expect(plainText(t[1].rows[0][0])).toBe("Agente - Tom 🦾");
  });
});

import { preprocessWikilinks } from "@/components/markdown/view";
describe("preprocessWikilinks", () => {
  it("converte wikilinks e preserva código", () => {
    expect(preprocessWikilinks("Veja [[Nota A|apelido]] e `[[nao]]`")).toBe("Veja [apelido](wikilink:Nota%20A) e `[[nao]]`");
    expect(preprocessWikilinks("[[Áreas da AG LABS#Gestão dos ambientes]]")).toBe("[Áreas da AG LABS › Gestão dos ambientes](wikilink:%C3%81reas%20da%20AG%20LABS#Gest%C3%A3o%20dos%20ambientes)");
    expect(preprocessWikilinks("| [[Página - X\\|X]] |")).toBe("| [X](wikilink:P%C3%A1gina%20-%20X) |");
    expect(preprocessWikilinks("![[logo.png]]")).toBe("![logo.png](embed:logo.png)");
  });
});
