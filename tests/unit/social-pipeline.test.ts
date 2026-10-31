import { describe, expect, it } from "vitest";
import { calendarGaps, deliveryChecks, nextFreeSlot, qualityScore, stageError } from "@/lib/social-pipeline";

const good = { network: "instagram" as const, hook: "Pare de perder 5h por semana", caption: "Legenda #ia #automacao", cta: 'Comente "GUIA"', mediaUrl: "https://cdn.example.com/a.mp4", referenceUrl: "https://example.com", scheduledAt: "2026-11-02T12:00:00-03:00", checks: {} };

describe("social pipeline", () => {
  it("aprova post completo sem nenhuma marcação manual", () => {
    expect(qualityScore(good)).toMatchObject({ score: 100, blocking: [] });
    expect(stageError(good, "agendado")).toBeNull();
  });
  it("bloqueia aprovação sem requisitos automáticos", () => {
    expect(stageError({ ...good, hook: "" }, "aprovado")).toMatch(/Gancho/);
  });
  it("exige data para agendar e permite etapas iniciais livres", () => {
    expect(stageError({ ...good, scheduledAt: null }, "agendado")).toMatch(/data/);
    expect(stageError({ network: "instagram" }, "rascunho")).toBeNull();
  });
  it("respeita limite de legenda por rede", () => {
    expect(qualityScore({ ...good, network: "threads", caption: "x".repeat(501) }).blocking.map(c => c.key)).toContain("caption");
  });
  it("conta lacunas por marca ignorando rascunhos", () => {
    const now = new Date("2026-11-01T12:00:00-03:00");
    const rows = calendarGaps([
      { brand: "aglabs" as const, stage: "agendado" as const, scheduledAt: new Date("2026-11-01T18:00:00-03:00") },
      { brand: "aglabs" as const, stage: "rascunho" as const, scheduledAt: new Date("2026-11-02T18:00:00-03:00") },
    ], now, 7);
    expect(rows.find(r => r.brand === "aglabs")?.gaps).toBe(6);
    expect(rows.find(r => r.brand === "members")?.gaps).toBe(7);
  });
});

describe("palavra-chave e entregas", () => {
  const kw = { ...good, caption: "Comenta ARQUIVO que eu te mando", checks: { keyword: "ARQUIVO", pageUrl: "https://conteudo.aglabs.ia.br/conteudos/arquivo", deliveryMessage: "Aqui: https://conteudo.aglabs.ia.br/conteudos/arquivo" } };
  it("sem palavra-chave não exige página nem mensagem", () => {
    expect(deliveryChecks(good)).toEqual([]);
    expect(stageError(good, "aprovado")).toBeNull();
  });
  it("com palavra-chave exige legenda com a palavra, página e mensagem com o link", () => {
    expect(stageError(kw, "aprovado")).toBeNull();
    expect(stageError({ ...kw, caption: "sem cta" }, "aprovado")).toMatch(/ARQUIVO/);
    expect(stageError({ ...kw, checks: { ...kw.checks, pageUrl: null } }, "aprovado")).toMatch(/Página/);
    expect(stageError({ ...kw, checks: { ...kw.checks, deliveryMessage: "sem link" } }, "aprovado")).toMatch(/Mensagem da DM/);
  });
  it("entregas do n8n são do sistema e não bloqueiam agendar", () => {
    expect(stageError(kw, "agendado")).toBeNull();
    expect(deliveryChecks(kw).map(c => [c.key, c.ok])).toEqual([["n8nCodeDone", false], ["n8nPostDone", false]]);
    expect(deliveryChecks({ checks: { keyword: "PROMPT" } })[0].ok).toBe(true);
  });
});

describe("próximo dia livre às 20h", () => {
  const brt = (s: string) => new Date(`${s}-03:00`);
  it("hoje às 20h se ainda faltam mais de 2 h", () => {
    expect(nextFreeSlot([], "aglabs", brt("2026-11-02T10:00:00"))).toEqual(brt("2026-11-02T20:00:00"));
  });
  it("amanhã se já passou das 18h", () => {
    expect(nextFreeSlot([], "aglabs", brt("2026-11-02T18:30:00"))).toEqual(brt("2026-11-03T20:00:00"));
  });
  it("pula dias ocupados da mesma marca e ignora outras marcas e falhas", () => {
    const posts = [
      { brand: "aglabs", stage: "agendado", scheduledAt: brt("2026-11-02T20:00:00") },
      { brand: "aglabs", stage: "revisao", scheduledAt: brt("2026-11-03T12:00:00") },
      { brand: "aglabs", stage: "falhou", scheduledAt: brt("2026-11-04T20:00:00") },
      { brand: "mecard", stage: "agendado", scheduledAt: brt("2026-11-04T20:00:00") },
    ];
    expect(nextFreeSlot(posts, "aglabs", brt("2026-11-02T09:00:00"))).toEqual(brt("2026-11-04T20:00:00"));
  });
});
