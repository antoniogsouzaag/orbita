import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CommercialPanels } from "@/components/empresa/product-commercial";
import type { CrmAggregateResult, CrmAggregateSummary, CrmEmailFunnel } from "@/lib/crm-aggregates";

const meta = { checkedAt: "2026-10-24T03:00:00.000Z", updatedAt: null, status: "ok" as const };
const summary: CrmAggregateResult<CrmAggregateSummary> = { ...meta, source: "CRM MCP · crm_resumo", data: { produto: "barberias", clientes: 2, funil: { Lead: 0 }, contas_no_produto: { trial: 4, trial_encerrado: 1, ativo: 3, cancelado: 0 } } };
const emails: CrmAggregateResult<CrmEmailFunnel> = { ...meta, source: "CRM MCP · crm_funil_emails", data: { produto: "barberias", dias: 30, desde: "2026-09-24T03:00:00.000Z", total: { enviados: 0, entregues: 0, taxa_entrega: null, taxa_abertura: null, taxa_clique: null, taxa_resposta: null } } };
const render = (s = summary, e = emails) => renderToStaticMarkup(createElement(CommercialPanels, { summary: s, emails: e }));

describe("painel comercial existente do produto", () => {
  it("separa quatro estados de conta e etapa Cliente, com origem e ressalvas", () => {
    const html = render();
    for (const label of ["Funil comercial", "Clientes · etapa Cliente", "Trial", "Trial encerrado", "Ativo", "Cancelado", "separadas de clientes pagantes", "CRM MCP · crm_resumo", "CRM MCP · crm_funil_emails", "Atualização na origem não informada", "pixel", "não comprova leitura humana", "30 dias"]) expect(html).toContain(label);
    expect(html).toMatch(new RegExp("Clientes · etapa Cliente</dt><dd[^>]*>2</dd>"));
    expect(html).toMatch(new RegExp("Ativo</dt><dd[^>]*>3</dd>"));
  });

  it("mostra zero real de envios e — para taxa sem base e contagem ausente", () => {
    const html = render();
    expect(html).toContain("Nenhum envio registrado");
    expect(html).toMatch(new RegExp("Enviados</dt><dd[^>]*>0</dd>"));
    expect(html).toMatch(new RegExp("Entrega / enviados</dt><dd[^>]*>—</dd>"));
    expect(html).toMatch(new RegExp("Abertos</dt><dd[^>]*>—</dd>"));
    expect(html).not.toContain(">0%<");
  });

  it("contas ausentes em CRM antigo não aparecem como zero", () => {
    const html = render({ ...summary, data: { produto: "barberias", clientes: 2 } });
    expect(html).toContain("Contas não informadas nesta versão do CRM");
    expect(html).toMatch(new RegExp("Ativo</dt><dd[^>]*>—</dd>"));
  });

  it("erro de uma fonte não zera nem remove os dados da outra", () => {
    const html = render(summary, { ...emails, status: "unavailable", data: null, message: "Consulta indisponível" });
    expect(html).toContain("Consulta indisponível");
    expect(html).toMatch(new RegExp("Clientes · etapa Cliente</dt><dd[^>]*>2</dd>"));
    expect(html).not.toContain("Nenhum envio registrado");
  });
});
