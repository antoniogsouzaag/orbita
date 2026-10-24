import { describe, expect, it } from "vitest";
import { formatOrbeNotes, ORBE_STRATEGY_RULES, selectOrbeNotes } from "@/lib/orbe-context";

const note = (title: string, body = "Contexto da empresa", path = `${title}.md`) => ({title,body,path,sha:"version-1",frontmatter:{updated:"2026-10-20"}});
const notes = [note("Identidade da AG LABS","Serviços e produtos próprios são duas frentes permanentes."),note("Portfólio Inicial"),note("Processo - Jornada Comercial e Follow-up"),note("Áreas da AG LABS"),note("Produto - Barberias","Ativação do teste e agendamento online."),note("Produto - Members"),note("Produto - MeCard"),note("Produto - Viajeki"),note("Treino pessoal","Rotina pessoal","06 - Projetos Pessoais/Treino.md")];

describe("contexto estratégico da ORBE", () => {
  it("busca direção, portfólio e comercial em pergunta ampla sem exigir frase literal", () => {
    const selected = selectOrbeNotes(notes,"O que a empresa deve priorizar hoje?",true);
    const titles = selected.map(item => item.title);
    expect(titles).toContain("Identidade da AG LABS");
    expect(titles).toContain("Portfólio Inicial");
    expect(titles).toContain("Processo - Jornada Comercial e Follow-up");
    expect(selected).toHaveLength(8);
    expect(selected.some(item => item.path.includes("Pessoais"))).toBe(false);
  });
  it("preserva o assunto dos turnos anteriores e aponta fonte, versão e trecho parcial", () => {
    const selected = selectOrbeNotes(notes,"Vamos discutir Barberias.\nE para crescer, qual o próximo passo?",true);
    expect(selected.some(item => item.title === "Produto - Barberias")).toBe(true);
    const formatted = formatOrbeNotes([note("Barberias","x".repeat(9000))]);
    expect(formatted).toContain("Versão: version-1");
    expect(formatted).toContain("ler_nota_do_vault");
    expect(formatted).toContain("/vault?p=Barberias.md");
    expect(formatted.length).toBeLessThan(5000);
  });
  it("permite recomendações fundamentadas sem converter proposta em ação automática", () => {
    expect(ORBE_STRATEGY_RULES).toContain("não significam ausência de prioridades");
    expect(ORBE_STRATEGY_RULES).toContain("não autoriza criar metas/tarefas");
    expect(ORBE_STRATEGY_RULES).toContain("primeiro passo verificável");
  });
});
