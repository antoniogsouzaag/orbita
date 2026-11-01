import { expect, it } from "vitest";
import { z } from "zod";
import { compactBrief, journalInput } from "@/lib/journal";
import { mcpErrorMessage } from "@/lib/mcp-errors";

const input = { registro_id: "11111111-1111-4111-8111-111111111111", data: "2026-11-01", secao: "ia", titulo: "Pesquisa de IA", resumo: "Síntese com uma fonte verificável.", conteudo: "Conteúdo da pesquisa com atribuição.", fontes: [{ titulo: "Fonte primária", url: "https://example.test/news" }] };
it("exige fonte de IA e recusa protocolos executáveis, credenciais e autoria informada pelo remetente", () => {
  expect(journalInput.safeParse(input).success).toBe(true);
  expect(journalInput.safeParse({ ...input, fontes: [] }).success).toBe(false);
  for (const url of ["javascript:alert(1)", "data:text/html,x", "https://user:secret@example.test/"]) expect(journalInput.safeParse({ ...input, fontes: [{ titulo: "Fonte", url }] }).success).toBe(false);
  expect(journalInput.safeParse({ ...input, autor: "Outro agente" }).success).toBe(false);
});
it("limita conteúdo, anexos de fontes e destaques sem exigir fonte externa para triagem interna", () => {
  expect(journalInput.safeParse({ ...input, secao: "emails", fontes: [] }).success).toBe(true);
  expect(journalInput.safeParse({ ...input, conteudo: "x".repeat(8001) }).success).toBe(false);
  expect(journalInput.safeParse({ ...input, pontos: Array(6).fill("Um ponto de atenção") }).success).toBe(false);
});
it("o resumo tem orçamento fixo e mantém o link e HTML inteiros", () => {
  const footer = '<a href="https://orb.test/jornal?data=2026-11-01">Ler Jornal</a>';
  const brief = compactBrief(Array.from({ length: 100 }, () => "• &lt;Uma informação &amp; outra&gt;".repeat(4)), footer);
  expect(brief.length).toBeLessThanOrEqual(1900);
  expect(brief.endsWith(footer)).toBe(true);
  expect(brief).not.toMatch(/&(?:l|lt|a|am)$/);
});
it("erros de ferramentas não expõem exceções ou corpos do provedor", () => {
  const error = new Error("Authorization: Bearer fixture-secret; customer@example.test");
  expect(mcpErrorMessage(error)).not.toMatch(/fixture-secret|customer@|Authorization/);
  const parsed = z.object({ nome: z.string() }).safeParse({});
  if (!parsed.success) expect(mcpErrorMessage(parsed.error)).toContain("nome: invalid_type");
});
