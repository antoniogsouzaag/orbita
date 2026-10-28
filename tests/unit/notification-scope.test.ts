import { beforeEach, describe, expect, it, vi } from "vitest";

const sources = vi.hoisted(() => ({ tasks: vi.fn(), calendar: vi.fn(), agents: vi.fn(), operation: vi.fn() }));
vi.mock("@/server/tasks", () => ({ listTasks: sources.tasks }));
vi.mock("@/server/calendar", () => ({ eventsBetween: sources.calendar }));
vi.mock("@/server/agents", () => ({ agentTasks: sources.agents }));
vi.mock("@/server/ops-live", () => ({ liveOps: sources.operation }));

import { loadNotifications } from "@/server/notifications";

beforeEach(() => {
  vi.clearAllMocks();
  sources.tasks.mockResolvedValue([]);
  sources.calendar.mockResolvedValue([]);
  sources.agents.mockResolvedValue([]);
  sources.operation.mockResolvedValue({ events: [], monitors: [] });
});

describe("fontes de notificação por espaço", () => {
  it("o padrão Pessoal consulta apenas tarefas pessoais e agenda", async () => {
    await loadNotifications();
    expect(sources.tasks).toHaveBeenCalledWith({ view: "atrasadas", limit: 30, scope: "pessoal" });
    expect(sources.calendar).toHaveBeenCalledOnce();
    expect(sources.agents).not.toHaveBeenCalled();
    expect(sources.operation).not.toHaveBeenCalled();
  });
  it("Empresa consulta suas tarefas, agentes e operação sem consultar agenda pessoal", async () => {
    await loadNotifications("empresa");
    expect(sources.tasks).toHaveBeenCalledWith({ view: "atrasadas", limit: 30, scope: "empresa" });
    expect(sources.calendar).not.toHaveBeenCalled();
    expect(sources.agents).toHaveBeenCalledOnce();
    expect(sources.operation).toHaveBeenCalledOnce();
  });
  it("distingue quedas, falhas e alertas de agentes nas notificações", async () => {
    sources.operation.mockResolvedValue({ events: [
      { id: "1", kind: "site_down", subject: "Site", severity: "critical", resolvedAt: null },
      { id: "2", kind: "workflow_error", subject: "Fluxo", severity: "warning", resolvedAt: null },
      { id: "3", kind: "agente_alerta", subject: "Agente", severity: "warning", resolvedAt: null },
    ], monitors: [] });
    expect((await loadNotifications("empresa")).map((notice) => notice.detail)).toEqual(["Queda de site", "Falha de automação", "Alerta operacional"]);
  });
});
