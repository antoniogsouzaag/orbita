import { describe, expect, it } from "vitest";
import { chatReferenceHref } from "@/lib/chat-reference";

describe("fontes no chat", () => {
  it("mantém nomes de ferramentas como texto sem inventar rotas", () => {
    for (const href of ["crm_prioridades", "crm_resumo", "metricas_produto, origem: app via CRM", undefined]) {
      expect(chatReferenceHref(href)).toBeNull();
    }
  });
  it("preserva URLs reais e rotas explícitas do aplicativo", () => {
    for (const href of ["https://crm.aglabs.api.br/actions", "/vault?p=MeCard", "/tarefas?id=123", "#fontes", "mailto:contato@example.com"]) {
      expect(chatReferenceHref(href)).toBe(href);
    }
  });
  it("não transforma protocolos ou caminhos ambíguos em links", () => {
    for (const href of ["//example.com", "/\\example.com", "javascript:alert(1)", "data:text/html,oi"]) {
      expect(chatReferenceHref(href)).toBeNull();
    }
  });
});
