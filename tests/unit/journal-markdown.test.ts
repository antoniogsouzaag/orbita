import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { JournalArticleBody, journalContentUrl } from "@/components/journal/article-body";

it("não carrega imagens de rastreamento, HTML ou protocolos ativos de matérias recebidas", () => {
  const html = renderToStaticMarkup(createElement(JournalArticleBody, { content: '<script>alert(1)</script>\n\n![pixel](https://tracker.test/pixel)\n\n[ruim](javascript:alert) [dados](data:text/html,x) [credencial](https://a:b@example.test) [fonte](https://example.test/source)' }));
  expect(html).not.toMatch(/<script|<img|javascript:|data:text|a:b@|tracker.test/);
  expect(html).toContain('href="https://example.test/source"');
  expect(html).toContain('rel="noreferrer"');
});
it("preserva referências internas explícitas sem aceitar URLs de rede disfarçadas", () => {
  expect(journalContentUrl("/operacao")).toBe("/operacao");
  expect(journalContentUrl("#fonte")).toBe("#fonte");
  for (const url of ["//example.test", "/\\example.test", "http://example.test", "file:///secret"]) expect(journalContentUrl(url)).toBe("");
});
