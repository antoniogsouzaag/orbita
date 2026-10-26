import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { POST } from "@/app/api/mcp/route";
import { getDb } from "@/db";
import { agentActivity, agentTokens, tasks } from "@/db/schema";
import { createAgentToken } from "@/server/agents";
import { assigneeOptions, claimTask, companyQueue, releaseTask, splitTask } from "@/server/task-claim";
import { insertTask, patchTask } from "@/server/task-write";

let n = 0;
async function call(token: string, name: string, args: object) {
  const res = await POST(new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++n, method: "tools/call", params: { name, arguments: args } }),
  }));
  const body = (await res.json()) as { result?: { content: { text: string }[]; isError?: boolean } };
  return { text: body.result?.content[0]?.text ?? JSON.stringify(body), isError: !!body.result?.isError };
}

const row = async (id: string) => (await (await getDb()).select().from(tasks).where(eq(tasks.id, id)))[0];

describe("fila multiagente da Empresa", () => {
  beforeEach(async () => {
    const db = await getDb();
    await db.delete(agentActivity);
    await db.delete(agentTokens);
    await db.delete(tasks);
  });

  it("dois agentes disputando a mesma tarefa: só um assume", async () => {
    const id = await insertTask({ title: "Migrar monitor", scope: "empresa" });
    const results = await Promise.all([claimTask(id, "Tom"), claimTask(id, "Hermes Oracle"), claimTask(id, "Claude Code")]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const saved = await row(id);
    expect(saved.status).toBe("doing");
    expect(saved.claimedAt).not.toBeNull();
    for (const loser of results.filter((r) => !r.ok)) expect(loser).toMatchObject({ ok: false, reason: "ocupada", holder: saved.assignee });
  });

  it("reafirmar a própria reserva é seguro e não reinicia o relógio nem duplica o histórico", async () => {
    const id = await insertTask({ title: "Revisar fila", scope: "empresa" });
    await claimTask(id, "Tom", "Começo pelo inventário");
    const first = await row(id);
    expect((await claimTask(id, "Tom", "Começo pelo inventário")).ok).toBe(true);
    const second = await row(id);
    expect(second.claimedAt?.getTime()).toBe(first.claimedAt?.getTime());
    expect(second.notes?.match(/Começo pelo inventário/g)).toHaveLength(1);
  });

  it("só o responsável libera; liberar devolve à fila", async () => {
    const id = await insertTask({ title: "Configurar alerta", scope: "empresa" });
    await claimTask(id, "Tom");
    expect(await releaseTask(id, "Hermes Oracle", "não é minha")).toMatchObject({ ok: false, reason: "ocupada", holder: "Tom" });
    expect((await releaseTask(id, "Tom", "Sem acesso ao painel do provedor")).ok).toBe(true);
    const saved = await row(id);
    expect(saved).toMatchObject({ status: "todo", assignee: null, claimedAt: null });
    expect(saved.notes).toContain("liberou\nSem acesso ao painel do provedor");
    expect((await claimTask(id, "Hermes Oracle")).ok).toBe(true);
  });

  it("não reserva tarefa pessoal, parte de tarefa pessoal ou concluída; parte da Empresa pode ser assumida", async () => {
    const personal = await insertTask({ title: "Academia", scope: "pessoal" });
    const personalChild = await insertTask({ title: "Treino A", parentId: personal });
    const done = await insertTask({ title: "Feita", scope: "empresa", status: "done" });
    const parent = await insertTask({ title: "Principal", scope: "empresa" });
    const child = await insertTask({ title: "Filha", parentId: parent });
    expect(await claimTask(personal, "Tom")).toMatchObject({ ok: false, reason: "nao_encontrada" });
    expect(await claimTask(personalChild, "Tom")).toMatchObject({ ok: false, reason: "nao_encontrada" });
    expect(await claimTask(done, "Tom")).toMatchObject({ ok: false, reason: "concluida" });
    expect(await claimTask(child, "Tom")).toMatchObject({ ok: true });
    expect(await claimTask(child, "Hermes Oracle")).toMatchObject({ ok: false, reason: "ocupada", holder: "Tom" });
    expect((await row(personal)).assignee).toBeNull();
  });

  it("divide tarefa grande em partes específicas, com repetição segura", async () => {
    const id = await insertTask({ title: "Conectar apps ao CRM e à Órbita", scope: "empresa", priority: 3, tags: ["integracoes"] });
    await claimTask(id, "Tom");
    const partes = [
      { titulo: "Members: ativar métricas no CRM", pronto_quando: "crm_metricas_produto members retorna ok e bate com o admin" },
      { titulo: "MeCard: ativar métricas no CRM", pronto_quando: "crm_metricas_produto mecard retorna ok e bate com o admin" },
    ];
    expect(await splitTask(id, "Hermes Oracle", "0b0d2f8e-0a43-4a0f-9a37-3c3a9bb5f1a1", { motivo: "grande", partes })).toMatchObject({ ok: false });
    const first = await splitTask(id, "Tom", "5d7a2a52-3e41-4c58-9a1e-6a0f6d2c1b11", { motivo: "Cinco apps; cada um tem ativação própria", partes });
    expect(first).toMatchObject({ ok: true, repeated: false });
    const again = await splitTask(id, "Tom", "5d7a2a52-3e41-4c58-9a1e-6a0f6d2c1b11", { motivo: "Cinco apps; cada um tem ativação própria", partes });
    expect(again).toMatchObject({ ok: true, repeated: true });
    const children = await (await getDb()).select().from(tasks).where(eq(tasks.parentId, id));
    expect(children).toHaveLength(2);
    expect(children.every((c) => c.scope === "empresa" && c.priority === 3 && c.tags.includes("integracoes") && c.notes?.startsWith("Pronto quando:"))).toBe(true);
    expect(await row(id)).toMatchObject({ status: "todo", assignee: null });
    expect((await row(id)).notes).toContain("dividiu em 2 partes");

    const queue = await companyQueue();
    expect(queue.find((t) => t.id === id)?.parts).toEqual({ total: 2, done: 0 });
    expect(queue.filter((t) => t.parentTitle === "Conectar apps ao CRM e à Órbita")).toHaveLength(2);

    await expect(splitTask(id, "Tom", "8f6c3f1e-1b7a-4c0e-8a55-2f7a1d9e3c22", { motivo: "x", partes: [{ titulo: "Genérico", pronto_quando: "depois" }] })).rejects.toThrow();
    expect(await splitTask(children[0].id, "Tom", "8f6c3f1e-1b7a-4c0e-8a55-2f7a1d9e3c23", { motivo: "parte", partes })).toMatchObject({ ok: false });
  });

  it("proprietário atribui e reatribui pela interface; o relógio acompanha a troca", async () => {
    const id = await insertTask({ title: "Planejar sprint", scope: "empresa", assignee: "  Antonio " });
    const created = await row(id);
    expect(created.assignee).toBe("Antonio");
    expect(created.claimedAt).not.toBeNull();
    expect(await claimTask(id, "Tom")).toMatchObject({ ok: false, reason: "ocupada" });
    await patchTask(id, { assignee: "Tom" });
    expect((await row(id)).assignee).toBe("Tom");
    await patchTask(id, { title: "Planejar sprint 2" });
    expect((await row(id)).assignee).toBe("Tom");
    await patchTask(id, { assignee: "" });
    expect(await row(id)).toMatchObject({ assignee: null, claimedAt: null });
  });

  it("fila mostra livres primeiro e sugere responsáveis conhecidos", async () => {
    const taken = await insertTask({ title: "Ocupada alta", scope: "empresa", priority: 3 });
    await insertTask({ title: "Livre baixa", scope: "empresa", priority: 1 });
    await insertTask({ title: "Livre alta", scope: "empresa", priority: 3 });
    await claimTask(taken, "Tom");
    expect((await companyQueue()).map((t) => t.title)).toEqual(["Livre alta", "Livre baixa", "Ocupada alta"]);
    await createAgentToken("Claude Code", ["tarefas"]);
    expect(await assigneeOptions()).toEqual(["Antonio", "Claude Code", "Tom"]);
  });

  it("MCP: fila, assumir, registrar andamento e liberar respeitam o responsável", async () => {
    const claude = await createAgentToken("Claude Code", ["tarefas"]);
    const tom = await createAgentToken("Tom", ["tarefas"]);
    const id = await insertTask({ title: "Status assumida na Órbita", scope: "empresa", priority: 3 });

    expect((await call(claude, "fila_empresa", {})).text).toContain("Status assumida na Órbita");
    const claimed = await call(claude, "assumir_tarefa", { id, plano: "Schema, MCP e UI" });
    expect(claimed.isError).toBe(false);
    expect(claimed.text).toContain("assumida");

    const blocked = await call(tom, "assumir_tarefa", { id });
    expect(blocked.isError).toBe(true);
    expect(blocked.text).toContain("Claude Code");
    expect((await call(tom, "fila_empresa", { somente_livres: true })).text).toContain("Nenhuma tarefa livre");

    // Tom não registra andamento na tarefa de outro responsável.
    const progress = { id, registro_id: "1f0e4a3c-6c55-4b39-9c1f-6c6b3a0a8d11", estado: "done", resumo: "Concluído com testes." };
    await call(tom, "atualizar_minha_tarefa", progress);
    expect((await row(id)).status).toBe("doing");
    await call(claude, "atualizar_minha_tarefa", progress);
    expect(await row(id)).toMatchObject({ status: "done", assignee: "Claude Code" });
    expect((await call(claude, "minhas_tarefas", {})).text).toContain("responsável Claude Code");

    const other = await insertTask({ title: "Outra", scope: "empresa" });
    await call(tom, "assumir_tarefa", { id: other });
    const release = await call(tom, "liberar_tarefa", { id: other, motivo: "Prioridade mudou" });
    expect(release.isError).toBe(false);
    expect((await row(other)).assignee).toBeNull();
  });

  it("MCP: dividir, assumir partes e avisar quando a última parte termina", async () => {
    const claude = await createAgentToken("Claude Code", ["tarefas"]);
    const tom = await createAgentToken("Tom", ["tarefas"]);
    const id = await insertTask({ title: "Telemetria dos produtos", scope: "empresa" });
    const split = await call(claude, "dividir_tarefa", { id, registro_id: "3c1f6a2e-7d44-4b1a-9e0c-5b2d8f1a6e01", motivo: "Um evento por produto", partes: [
      { titulo: "VibeKit: registrar clique no checkout", pronto_quando: "evento chega ao CRM com produto e horário" },
      { titulo: "Barberias: registrar falha de ativação", pronto_quando: "evento chega ao CRM com conta anonimizada" },
    ] });
    expect(split.isError).toBe(false);
    const ids = [...split.text.matchAll(/\(([0-9a-f-]{36})\)/g)].map((m) => m[1]);
    expect(ids).toHaveLength(2);
    expect((await call(tom, "fila_empresa", {})).text).toContain("[parte de “Telemetria dos produtos”] VibeKit");
    expect((await call(tom, "fila_empresa", {})).text).toContain("dividida: 0/2");
    await call(claude, "assumir_tarefa", { id: ids[0] });
    await call(tom, "assumir_tarefa", { id: ids[1] });
    const done1 = await call(claude, "atualizar_minha_tarefa", { id: ids[0], registro_id: "3c1f6a2e-7d44-4b1a-9e0c-5b2d8f1a6e02", estado: "done", resumo: "Evento publicado e conferido." });
    expect(done1.text).not.toContain("Todas as partes");
    const done2 = await call(tom, "atualizar_minha_tarefa", { id: ids[1], registro_id: "3c1f6a2e-7d44-4b1a-9e0c-5b2d8f1a6e03", estado: "done", resumo: "Evento publicado e conferido." });
    expect(done2.text).toContain("Todas as partes de “Telemetria dos produtos” estão concluídas");
  });

  it("pedido marcado para um agente não pode ser tomado pela tag depois de assumido por outro", async () => {
    const tom = await createAgentToken("Tom", ["tarefas"]);
    const [task] = await (await getDb()).insert(tasks).values({ title: "Pedido do Tom", scope: "empresa", tags: ["agente:tom"] }).returning();
    await claimTask(task.id, "Claude Code");
    await call(tom, "atualizar_minha_tarefa", { id: task.id, registro_id: "9a9f2a43-7a63-4a8a-8f7e-1d1b1d2f2b10", estado: "done", resumo: "Tentativa indevida." });
    expect(await row(task.id)).toMatchObject({ status: "doing", assignee: "Claude Code" });
  });
});
