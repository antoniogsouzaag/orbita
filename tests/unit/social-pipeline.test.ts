import { describe, expect, it } from "vitest";
import { calendarGaps, qualityScore, stageError } from "@/lib/social-pipeline";

const good = { network: "instagram" as const, hook: "Pare de perder 5h por semana", caption: "Legenda #ia #automacao", cta: 'Comente "GUIA"', mediaUrl: "https://cdn.example.com/a.mp4", referenceUrl: "https://example.com", scheduledAt: "2026-11-02T12:00:00-03:00", checks: { brandReviewed: true, ctaDeliverable: true } };

describe("social pipeline", () => {
  it("aprova post completo", () => {
    expect(qualityScore(good)).toMatchObject({ score: 100, blocking: [] });
    expect(stageError(good, "agendado")).toBeNull();
  });
  it("bloqueia aprovação sem requisitos obrigatórios", () => {
    const err = stageError({ ...good, hook: "", checks: {} }, "aprovado");
    expect(err).toMatch(/Gancho/);
    expect(err).toMatch(/tom e identidade/);
  });
  it("exige data para agendar e permite etapas iniciais livres", () => {
    expect(stageError({ ...good, scheduledAt: null }, "agendado")).toMatch(/data/);
    expect(stageError({ network: "instagram" }, "rascunho")).toBeNull();
  });
  it("respeita limite de legenda por rede", () => {
    expect(qualityScore({ ...good, network: "threads", caption: "x".repeat(501) }).blocking.map(c => c.key)).toContain("caption");
  });
  it("CTA sem material confirmado bloqueia", () => {
    expect(qualityScore({ ...good, checks: { brandReviewed: true } }).blocking.map(c => c.key)).toEqual(["ctaDeliverable"]);
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
