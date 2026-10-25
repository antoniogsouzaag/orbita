import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProposalContext } from "@/components/empresa/proposal-context";

describe("leitura segura de propostas", () => {
  it("preserva decisão atual e recolhe histórico no formato do GitHub", () => {
    const html = renderToStaticMarkup(createElement(ProposalContext, { content: "## Decisão atual\n\nEscolher prioridade.\n\n<details><summary>Histórico original</summary>\n\nTexto anterior.\n</details>\n\nPróximo passo." }));
    expect(html).toContain("Decisão atual");
    expect(html).toContain("<details class=");
    expect(html).toContain("Histórico original");
    expect(html).toContain("Texto anterior");
    expect(html).toContain("Próximo passo");
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html).not.toContain("&lt;details");
  });
  it("não executa HTML nem carrega imagens remotas da origem", () => {
    const html = renderToStaticMarkup(createElement(ProposalContext, { content: '<script>alert(1)</script>\n\n![Anexo](https://tracking.example.invalid/image)\n\n[link](javascript:alert(1))' }));
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("tracking.example.invalid");
    expect(html).toContain("Anexo");
  });
});
