import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { events, opsEvents, opsHeartbeats, tasks } from "@/db/schema";
import { shiftDate, today } from "@/lib/dates";
import { acknowledgeNotifications } from "@/lib/notifications";
import { loadNotifications } from "@/server/notifications";

describe("notificações operacionais", () => {
  beforeAll(async () => {
    const db = await getDb();
    const yesterday = shiftDate(today(), -1);
    await db.insert(tasks).values([
      { title: "Pessoal vencida", dueDate: yesterday, scope: "pessoal" },
      { title: "Empresa vencida", dueDate: yesterday, scope: "empresa" },
      { title: "Pedido de Hermes", dueDate: yesterday, scope: "empresa", tags: ["agente:hermes"] },
      { title: "Pedido resolvido", status: "done", scope: "empresa", tags: ["agente:hermes"] },
    ]);
    await db.insert(events).values({ title: "Reunião em andamento", startAt: new Date(Date.now() - 60_000), endAt: new Date(Date.now() + 60_000) });
    await db.insert(opsEvents).values([
      { kind: "workflow_error", severity: "critical", source: "teste", subject: "Workflow falhou" },
      { kind: "site_down", severity: "critical", source: "teste", subject: "Já resolvido", resolvedAt: new Date() },
    ]);
    await db.insert(opsHeartbeats).values({ source: "teste", label: "Monitor parado", everyMinutes: 5, lastSeen: new Date(Date.now() - 60 * 60_000) });
  });

  it("inclui incidentes, monitor silencioso, pedidos e eventos sem duplicar tarefa do agente", async () => {
    const rows = await loadNotifications();
    expect(rows.map((row) => row.title)).toEqual(expect.arrayContaining(["Workflow falhou", "Monitor parado", "Pedido de Hermes", "Reunião em andamento", "Empresa vencida", "Pessoal vencida"]));
    expect(rows.filter((row) => row.title === "Pedido de Hermes")).toHaveLength(1);
    expect(rows.some((row) => ["Pedido resolvido", "Já resolvido"].includes(row.title))).toBe(false);
    expect(rows.find((row) => row.title === "Empresa vencida")?.href).toContain("escopo=empresa");
    expect(rows.find((row) => row.title === "Reunião em andamento")?.detail).toBe("Em andamento");
  });

  it("mantém IDs lidos únicos e limitados, sem guardar conteúdo", () => {
    const ids = Array.from({ length: 350 }, (_, index) => `id-${index}`);
    const read = acknowledgeNotifications(ids, ["novo", "novo"]);
    expect(read).toHaveLength(300);
    expect(read.at(-1)).toBe("novo");
    expect(read).not.toContain("id-0");
  });
});
