import { describe, expect, it } from "vitest";
import { matchProject, parseTaskInput } from "@/lib/parse-task";

const REF = "2026-10-22"; // quinta-feira

describe("parseTaskInput", () => {
  it("extrai tags, prioridade, data, hora e projeto", () => {
    const r = parseTaskInput("Revisar proposta #empresa !alta amanhã 15h @barberias", REF);
    expect(r).toEqual({ title: "Revisar proposta", tags: ["empresa"], priority: 3, dueDate: "2026-10-23", dueTime: "15:00", projectQuery: "barberias" });
  });
  it("hoje e minutos", () => {
    const r = parseTaskInput("Ligar contador hoje às 9h30", REF);
    expect(r.dueDate).toBe(REF);
    expect(r.dueTime).toBe("09:30");
    expect(r.title).toBe("Ligar contador");
  });
  it("dia da semana vai para a próxima ocorrência", () => {
    expect(parseTaskInput("Treino sexta", REF).dueDate).toBe("2026-10-23");
    expect(parseTaskInput("Reunião quinta", REF).dueDate).toBe("2026-10-29");
    expect(parseTaskInput("Feira sábado", REF).dueDate).toBe("2026-10-24");
  });
  it("datas dd/mm, em N dias e depois de amanhã", () => {
    expect(parseTaskInput("Pagar boleto 05/11", REF).dueDate).toBe("2026-11-05");
    expect(parseTaskInput("Renovar 10/01", REF).dueDate).toBe("2027-01-10");
    expect(parseTaskInput("Ver isso em 3 dias", REF).dueDate).toBe("2026-10-25");
    expect(parseTaskInput("Viagem depois de amanhã", REF).dueDate).toBe("2026-10-24");
  });
  it("hora sem data assume hoje e mantém texto comum", () => {
    const r = parseTaskInput("Call 14:00 !media", REF);
    expect(r).toMatchObject({ dueDate: REF, dueTime: "14:00", priority: 2, title: "Call" });
  });
  it("não confunde palavras normais", () => {
    const r = parseTaskInput("Estudar 3 capítulos de programação !xyz", REF);
    expect(r.title).toBe("Estudar 3 capítulos de programação !xyz");
    expect(r.priority).toBe(0);
    expect(r.dueDate).toBeNull();
  });
  it("tags com acento são normalizadas e sem duplicata", () => {
    expect(parseTaskInput("x #Música #musica", REF).tags).toEqual(["musica"]);
  });
});

describe("matchProject", () => {
  const ps = [{ id: "1", name: "Faculdade" }, { id: "2", name: "AG LABS App" }, { id: "3", name: "Easy Pay" }];
  it("casa por prefixo, sem acento e sem espaços", () => {
    expect(matchProject("facul", ps)?.id).toBe("1");
    expect(matchProject("aglabs", ps)?.id).toBe("2");
    expect(matchProject("easy-pay", ps)?.id).toBe("3");
    expect(matchProject("nada", ps)).toBeUndefined();
  });
});
