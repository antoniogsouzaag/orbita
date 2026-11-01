import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ calendar: vi.fn(), tasks: vi.fn(), ops: vi.fn() }));
vi.mock("@/server/calendar", () => ({ eventsBetween: mocks.calendar }));
vi.mock("@/server/tasks", () => ({ listTasks: mocks.tasks }));
vi.mock("@/server/ops-live", () => ({ liveOps: mocks.ops }));
import { JournalDailyContext } from "@/components/journal/daily-context";
import { today, zonedToUtc } from "@/lib/dates";
import { journalDailyMetrics } from "@/lib/journal-daily";
import type { ProductMetrics } from "@/lib/product-metrics";

beforeEach(() => {
  vi.stubGlobal("React", React);
  mocks.calendar.mockResolvedValue([]);
  mocks.tasks.mockResolvedValue([]);
  mocks.ops.mockResolvedValue({ status: [], events: [], monitors: [], generatedAt: Date.now() });
});
it("não cria cartões vazios nem contagens de saúde rotineira", async () => {
  expect(await JournalDailyContext()).toBeNull();
});
it("expõe o assunto e a origem de alerta antigo e permite abrir o incidente exato", async () => {
  mocks.ops.mockResolvedValue({ status: [], monitors: [], generatedAt: Date.now(), events: [{ id: "alert-1", kind: "agente_alerta", severity: "warning", subject: "Revisar integração", source: "agente:hermes", createdAt: new Date("2026-10-15T12:00:00Z"), resolvedAt: null, detail: {} }] });
  const html = renderToStaticMarkup(await JournalDailyContext());
  expect(html).toContain("Revisar integração");
  expect(html).toContain("agente:hermes");
  expect(html).toContain('/operacao#evento-alert-1');
  expect(html).not.toContain("sinais");
});
it("narra uma recuperação de hoje uma única vez", async () => {
  const at = zonedToUtc(today());
  mocks.ops.mockResolvedValue({ status: [], monitors: [], generatedAt: Date.now(), events: [
    { id: "down", kind: "site_down", severity: "critical", subject: "App", createdAt: at, resolvedAt: at, detail: {} },
    { id: "up", kind: "site_up", severity: "info", subject: "App", createdAt: at, resolvedAt: null, detail: {} },
  ] });
  const html = renderToStaticMarkup(await JournalDailyContext());
  expect(html).toContain("voltou ao ar");
  expect(html).not.toContain("Precisa de atenção");
  expect(html.match(/App/g)).toHaveLength(1);
});
it("só publica números diários positivos com janela explícita do mesmo dia", () => {
  const base = { generatedAt: "2026-11-01T15:00:00Z", daily: { date: "2026-11-01", timeZone: "America/Sao_Paulo", from: "2026-11-01T03:00:00Z", to: "2026-11-01T15:00:00Z", newUsers: 2, sales: 0 } } as ProductMetrics;
  expect(journalDailyMetrics(base, "2026-11-01")?.newUsers).toBe(2);
  expect(journalDailyMetrics(base, "2026-11-02")).toBeNull();
  expect(journalDailyMetrics({ ...base, daily: undefined }, "2026-11-01")).toBeNull();
  expect(journalDailyMetrics({ ...base, daily: { ...base.daily!, newUsers: 0 } }, "2026-11-01")).toBeNull();
  expect(journalDailyMetrics({ ...base, daily: { ...base.daily!, from: "2026-10-01T03:00:00Z" } }, "2026-11-01")).toBeNull();
});
it("mostra a tarefa pelo título e abre seu detalhe no escopo correto", async () => {
  mocks.tasks.mockImplementation(async ({ scope }: { scope: string }) => scope === "empresa" ? [{ id: "task-1", title: "Revisar proposta", tags: [], dueDate: today(), dueTime: "14:00" }] : []);
  const html = renderToStaticMarkup(await JournalDailyContext());
  expect(html).toContain("Revisar proposta");
  expect(html).toContain("escopo=empresa&amp;view=hoje&amp;task=task-1");
  expect(html).not.toContain("0 pessoais");
});
