import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { StageDistribution } from "@/components/empresa/stage-distribution";

it("mostra participação no estoque atual sem inventar conversão ou exceder 100%", () => {
  const html = renderToStaticMarkup(createElement(StageDistribution, { rows: [{ label: "Lead", value: 2 }, { label: "Contatado", value: 8 }] }));
  expect(html).toContain("20% do total");
  expect(html).toContain("80% do total");
  expect(html).not.toContain("400");
  expect(html).not.toContain("da anterior");
});
it("não calcula percentuais quando falta uma etapa", () => {
  const html = renderToStaticMarkup(createElement(StageDistribution, { rows: [{ label: "Lead", value: 2 }, { label: "Proposta", value: null }] }));
  expect(html).toContain("—");
  expect(html).not.toContain("% do total");
});
