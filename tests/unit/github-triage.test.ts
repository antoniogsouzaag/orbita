import { describe, expect, it } from "vitest";
import { GITHUB_STAGES, issueStage, stageLabel } from "@/lib/github-triage";
describe("triagem explícita de evolução", () => {
  it.each([[["execucao"],"execution"],[["decisao"],"decision"],[["proposta"],"triage"],[[],"triage"],[["aprovado"],"execution"],[["execucao","decisao"],"decision"]] as const)("classifica etiquetas sem inferir pelo título: %s", (labels, expected) => expect(issueStage([...labels])).toBe(expected));
  it("não transforma execução bloqueada em concluída ou decisão humana", () => expect(stageLabel({kind:"proposta",stage:"execution",blocked:true})).toBe("Fila de execução · bloqueada"));
  it("separa revisão de PR e proposta legada", () => { expect(stageLabel({kind:"pr",draft:true})).toBe("PR rascunho");expect(stageLabel({kind:"proposta"})).toBe("A classificar"); });
  it("mantém três filas distintas, sem status concluído para issue aberta", () => expect(GITHUB_STAGES.map(s => s.id)).toEqual(["decision","execution","triage"]));
});
