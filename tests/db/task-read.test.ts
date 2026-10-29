import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { tasks } from "@/db/schema";
import { assistantTools, runAssistantTool } from "@/server/assistant";

const company = { scope: "empresa" as const, readOnly: true };
describe("leitura contextual de tarefa e evidência", () => {
  it("lê notas de conclusão em somente leitura sem alterar tarefa nem gerar recibo de escrita", async () => {
    const db = await getDb();
    const [task] = await db.insert(tasks).values({ title: "Correção registrada", scope: "empresa", status: "done", assignee: "Tom", notes: "Execução relatada pelo agente. Evidência: commit sintético.", completedAt: new Date() }).returning();
    expect(assistantTools("empresa", { readOnly: true }).some(tool => tool.name === "consultar_tarefa")).toBe(true);
    const result = await runAssistantTool("consultar_tarefa", { id: task.id }, company);
    expect(result.ok).toBe(true);
    expect(result.action).toBeUndefined();
    expect(JSON.parse(result.text)).toMatchObject({ id: task.id, status: "done", responsavel: "Tom", escopo: "empresa", notas: { trecho: task.notes, proximo_inicio: null } });
    expect(JSON.parse(result.text).fonte).toContain("não são verificação independente");
    expect((await db.select().from(tasks).where(eq(tasks.id, task.id)))[0]).toEqual(task);
  });

  it("nega UUID pessoal conhecido na Empresa, escopo explícito divergente e UUID ausente sem expor conteúdo", async () => {
    const db = await getDb();
    const [task] = await db.insert(tasks).values({ title: "Privado", scope: "pessoal", notes: "conteudo-pessoal-sentinela" }).returning();
    for (const args of [{ id: task.id }, { id: task.id, escopo: "pessoal" }, { id: "00c0277f-c6d8-4a50-80b1-b4de45953d91" }]) {
      const result = await runAssistantTool("consultar_tarefa", args, company);
      expect(result.ok).toBe(false);
      expect(result.text).not.toContain("sentinela");
    }
    const allowed = await runAssistantTool("consultar_tarefa", { id: task.id }, { scope: "pessoal", readOnly: true });
    expect(JSON.parse(allowed.text).notas.trecho).toBe("conteudo-pessoal-sentinela");
    expect((await runAssistantTool("consultar_tarefa", { id: "invalid" }, company)).ok).toBe(false);
  });

  it("pagina sem ocultar a continuação e recusa misturar versões após edição", async () => {
    const db = await getDb();
    const body = `${"a".repeat(6000)}Conclusão e evidência no final`;
    const [task] = await db.insert(tasks).values({ title: "Histórico longo", scope: "empresa", notes: body }).returning();
    const first = JSON.parse((await runAssistantTool("consultar_tarefa", { id: task.id }, company)).text);
    expect(first.notas.trecho.length).toBe(6000);
    expect(first.notas.proximo_inicio).toBe(6000);
    expect((await runAssistantTool("consultar_tarefa", { id: task.id, inicio: 6000 }, company)).ok).toBe(false);
    const next = JSON.parse((await runAssistantTool("consultar_tarefa", { id: task.id, inicio: first.notas.proximo_inicio, versao: first.versao }, company)).text);
    expect(first.notas.trecho + next.notas.trecho).toBe(body);
    expect(next.notas.proximo_inicio).toBeNull();
    await db.update(tasks).set({ notes: "Novo relato; a evidência anterior mudou" }).where(eq(tasks.id, task.id));
    const stale = await runAssistantTool("consultar_tarefa", { id: task.id, inicio: 6000, versao: first.versao }, company);
    expect(stale.ok).toBe(false);
    expect(stale.text).toContain("mudou");
  });
});
