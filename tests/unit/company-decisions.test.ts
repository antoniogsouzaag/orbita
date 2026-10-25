import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { WaitingWidget } from "@/components/empresa/widgets";
import type { GithubInbox } from "@/server/github-inbox";
const props = { asks: [], due: [], crmMine: [], crmTasksUrl: null, today: "2026-10-24" };
it("decisões classificadas aparecem no início sem converter execução em decisão", () => {
  const github: GithubInbox = { configured: true, error: null, org: "fixture", credential: "GITHUB_TOKEN", checkedAt: "2026-10-24T12:00:00Z", total: 30, truncated: false, warning: "", items: [
    ...Array.from({ length: 29 }, (_, i) => ({ kind: "proposta" as const, stage: "decision" as const, title: `Decisão ${i}`, repo: "app", url: `https://github.com/org/app/issues/${i}`, number: i, updatedAt: "2026-10-24T12:00:00Z", author: "agente" })),
    { kind: "proposta", stage: "execution", title: "Correção técnica em execução", repo: "app", url: "https://github.com/org/app/issues/99", number: 99, updatedAt: "2026-10-24T12:00:00Z", author: "agente" },
  ] };
  const html = renderToStaticMarkup(createElement(WaitingWidget, { ...props, github }));
  expect(html).toContain("29 itens");
  expect(html).toContain("Revisar 29 decisões");
  expect(html).toContain("/github?etapa=decision");
  expect(html).not.toContain("Correção técnica em execução");
});
it("carregamento não anuncia ausência de decisões antes de consultar a fonte", () => {
  const html = renderToStaticMarkup(createElement(WaitingWidget, props));
  expect(html).toContain("Conferindo decisões");
  expect(html).not.toContain("Nada esperando por você");
});
