import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { opsEvents, opsStatus, tasks } from "@/db/schema";
import { today } from "@/lib/dates";

describe("pessoal × empresa e bom dia", () => {
  beforeAll(async () => {
    const db = await getDb();
    await db.delete(tasks);
    await db.delete(opsEvents);
    await db.delete(opsStatus);
    const t = today();
    await db.insert(tasks).values([
      { title: "Pagar academia", dueDate: t, scope: "pessoal" },
      { title: "Revisar proposta <Gabi>", dueDate: t, scope: "empresa", priority: 3 },
      { title: "Aprovar PR do Barberias", dueDate: t, scope: "empresa", tags: ["agente", "agente:hermes-oracle"] },
    ]);
  });

  it("filtra tarefas por escopo", async () => {
    const { listTasks, taskCounts } = await import("@/server/tasks");
    expect((await listTasks({ view: "hoje", scope: "pessoal" })).map((x) => x.title)).toEqual(["Pagar academia"]);
    expect(await listTasks({ view: "hoje", scope: "empresa" })).toHaveLength(2);
    expect((await taskCounts("empresa")).today).toBe(2);
    expect((await taskCounts()).today).toBe(3);
  });

  it("monta o bom dia com as duas listas, pedidos dos agentes e HTML escapado", async () => {
    const { buildBrief } = await import("@/server/brief");
    const text = await buildBrief();
    expect(text).toContain("<b>Pessoal</b>");
    expect(text).toContain("Pagar academia");
    expect(text).toContain("<b>Empresa</b>");
    expect(text).toContain("Revisar proposta &lt;Gabi&gt;");
    expect(text).toContain("Pedidos dos agentes");
    expect(text).toContain("hermes-oracle");
  });

  it("IA cria tarefa da empresa quando pedido", async () => {
    const { runAssistantTool } = await import("@/server/assistant");
    const r = await runAssistantTool("criar_tarefa", { titulo: "Ligar para contador", escopo: "empresa" });
    expect(r.ok).toBe(true);
    const db = await getDb();
    const row = (await db.select().from(tasks)).find((x) => x.title === "Ligar para contador")!;
    expect(row.scope).toBe("empresa");
  });

  it("senha definida no app tem prioridade sobre a do ambiente", async () => {
    const { passwordMatchesAny, updateSecurity } = await import("@/lib/auth");
    const { hashPassword } = await import("@/lib/password");
    process.env.ORBITA_PASSWORD = "senha-do-ambiente-123";
    expect(await passwordMatchesAny("senha-do-ambiente-123")).toBe(true);
    await updateSecurity({ passwordHash: hashPassword("nova-senha-forte-456") });
    expect(await passwordMatchesAny("nova-senha-forte-456")).toBe(true);
    expect(await passwordMatchesAny("senha-do-ambiente-123")).toBe(false);
  });
});
