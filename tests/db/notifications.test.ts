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

  it("Empresa inclui operação, pedidos e tarefas empresariais sem dados pessoais ou duplicação", async () => {
    const rows = await loadNotifications("empresa");
    expect(rows.map((row) => row.title)).toEqual(expect.arrayContaining(["Workflow falhou", "Monitor parado", "Pedido de Hermes", "Empresa vencida"]));
    expect(rows.filter((row) => row.title === "Pedido de Hermes")).toHaveLength(1);
    expect(rows.some((row) => ["Pedido resolvido", "Já resolvido", "Pessoal vencida", "Reunião em andamento"].includes(row.title))).toBe(false);
    expect(rows.find((row) => row.title === "Empresa vencida")?.href).toContain("escopo=empresa");
  });

  it("Pessoal inclui tarefas pessoais e agenda sem avisos empresariais", async () => {
    const rows = await loadNotifications("pessoal");
    expect(rows.map((row) => row.title)).toEqual(expect.arrayContaining(["Reunião em andamento", "Pessoal vencida"]));
    expect(rows.some((row) => ["Empresa vencida", "Pedido de Hermes", "Workflow falhou", "Monitor parado"].includes(row.title))).toBe(false);
    expect(rows.find((row) => row.title === "Reunião em andamento")?.detail).toBe("Em andamento");
    expect(rows.find((row) => row.title === "Pessoal vencida")?.href).not.toContain("escopo=empresa");
  });

  it("mantém IDs lidos únicos e limitados, sem guardar conteúdo", () => {
    const ids = Array.from({ length: 350 }, (_, index) => `id-${index}`);
    const read = acknowledgeNotifications(ids, ["novo", "novo"]);
    expect(read).toHaveLength(300);
    expect(read.at(-1)).toBe("novo");
    expect(read).not.toContain("id-0");
  });
});
