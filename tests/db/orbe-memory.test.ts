import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { agentTokens, orbeConversations, orbeMemories, tasks } from "@/db/schema";
import { addMemory, listMemories, memoryContext, MEMORY_LIMITS, removeMemory, replaceMemory } from "@/server/orbe-memory";
import { conversationsToConsolidate, expireConversations, getConversation, markConsolidated, saveConversation, searchConversations } from "@/server/orbe-conversations";
import { assistantTools, runAssistantTool } from "@/server/assistant";

beforeEach(async () => {
  const db = await getDb();
  await db.delete(orbeMemories);
  await db.delete(orbeConversations);
});

describe("memória da ORBE com limite", () => {
  it("adiciona, substitui por trecho e remove", async () => {
    expect((await addMemory("geral", "Prefere respostas diretas, em tópicos curtos.")).ok).toBe(true);
    expect((await addMemory("geral", "Prefere respostas diretas, em tópicos curtos.")).message).toContain("já existe");
    expect((await replaceMemory("geral", "tópicos curtos", "Prefere respostas diretas, começando pelo resultado.")).ok).toBe(true);
    expect((await listMemories(["geral"]))[0].content).toContain("começando pelo resultado");
    expect((await removeMemory("geral", "começando")).ok).toBe(true);
    expect(await listMemories(["geral"])).toHaveLength(0);
  });

  it("recusa quando o bloco está cheio, forçando escolher", async () => {
    const chunk = "x".repeat(390);
    let added = 0;
    for (let i = 0; i < 10; i++) if ((await addMemory("geral", `${i}${chunk}`)).ok) added++;
    expect(added).toBe(Math.floor(MEMORY_LIMITS.geral / 391));
    const full = await addMemory("geral", `Outra anotação ${"y".repeat(300)}`);
    expect(full.ok).toBe(false);
    expect(full.message).toContain("cheia");
  });

  it("trecho ambíguo ou ausente não altera nada", async () => {
    await addMemory("empresa", "Barberias: relatórios sempre com janela e fonte.");
    await addMemory("empresa", "Barberias: priorizar ativação antes de aquisição.");
    expect((await removeMemory("empresa", "Barberias")).ok).toBe(false);
    expect((await removeMemory("empresa", "inexistente")).ok).toBe(false);
    expect(await listMemories(["empresa"])).toHaveLength(2);
  });

  it("não guarda segredos", async () => {
    await expect(addMemory("geral", "A chave é sk-abcdefghijklmnopqrstuvwxyz")).rejects.toThrow();
    await expect(addMemory("geral", "senha: hunter22222")).rejects.toThrow();
  });

  it("contexto mostra só geral + espaço atual, com uso", async () => {
    await addMemory("geral", "Responder em português do Brasil.");
    await addMemory("pessoal", "Treina às 18h nos dias úteis.");
    await addMemory("empresa", "Tom coordena o VPS-02.");
    const pessoal = await memoryContext("pessoal");
    expect(pessoal).toContain("Treina às 18h");
    expect(pessoal).not.toContain("Tom coordena");
    expect(pessoal).toMatch(/\d+\/1400 caracteres/);
  });

  it("ferramenta respeita o espaço da conversa e explica recusas", async () => {
    const outro = await runAssistantTool("memoria", { acao: "adicionar", espaco: "empresa", texto: "Algo da empresa" }, { scope: "pessoal" });
    expect(outro.ok).toBe(false);
    const ok = await runAssistantTool("memoria", { acao: "adicionar", espaco: "geral", texto: "Gosta de exemplos concretos." }, { scope: "pessoal" });
    expect(ok.ok).toBe(true);
    expect(ok.action?.label).toContain("Memória");
    const bad = await runAssistantTool("memoria", { acao: "remover", espaco: "geral", trecho_antigo: "nada parecido" }, { scope: "pessoal" });
    expect(bad).toMatchObject({ ok: false, text: expect.stringContaining("Nenhuma anotação") });
    expect(assistantTools("pessoal", { readOnly: true }).some((t) => t.name === "memoria")).toBe(false);
  });
});

describe("conversas guardadas", () => {
  const id = "2b1f6d2e-7c4a-4b8e-9f00-1a2b3c4d5e6f";
  const msgs = [{ role: "user" as const, content: "Como está o Barberias?" }, { role: "assistant" as const, content: "Ativação em foco." }];

  it("salva, busca e não muda de espaço", async () => {
    await saveConversation(id, { scope: "empresa", messages: msgs });
    expect((await getConversation(id, "empresa"))?.title).toBe("Como está o Barberias?");
    expect(await getConversation(id, "pessoal")).toBeNull();
    await expect(saveConversation(id, { scope: "pessoal", messages: msgs })).rejects.toThrow();
    expect((await searchConversations("empresa", "barberias ativação"))[0].excerpt).toContain("Barberias");
    expect(await searchConversations("pessoal", "barberias")).toHaveLength(0);
  });

  it("só apaga conversa expirada depois de consolidada", async () => {
    await saveConversation(id, { scope: "pessoal", messages: msgs });
    const db = await getDb();
    const old = new Date(Date.now() - 90 * 86_400_000);
    await db.update(orbeConversations).set({ updatedAt: old });
    expect((await conversationsToConsolidate()).map((c) => c.id)).toContain(id);
    expect(await expireConversations()).toBe(0);
    await markConsolidated(id);
    expect(await conversationsToConsolidate()).toHaveLength(0);
    expect(await expireConversations()).toBe(1);
  });
});

describe("pedidos aos agentes pela ORBE", () => {
  it("cria a tarefa da Empresa atribuída ao agente e recusa nome desconhecido", async () => {
    const db = await getDb();
    await db.delete(tasks);
    await db.delete(agentTokens);
    await db.insert(agentTokens).values({ name: "Tom", tokenHash: "h-tom", prefix: "orb_t", scopes: ["tarefas"] });
    const r = await runAssistantTool("pedir_a_agente", { agente: "tom", pedido: "MeCard: ativar métricas no CRM", detalhe: "Pronto quando bater com o admin." }, { scope: "pessoal" });
    expect(r.ok).toBe(true);
    const [task] = await db.select().from(tasks);
    expect(task).toMatchObject({ scope: "empresa", assignee: "Tom", title: "MeCard: ativar métricas no CRM" });
    expect(task.tags).toContain("agente:tom");
    const unknown = await runAssistantTool("pedir_a_agente", { agente: "Fulano", pedido: "Fazer algo útil" }, { scope: "empresa" });
    expect(unknown).toMatchObject({ ok: false, text: expect.stringContaining("Tom") });
    const status = await runAssistantTool("status_agentes", {}, { scope: "empresa" });
    expect(status.text).toContain("MeCard: ativar métricas no CRM");
  });

  it("ferramentas da ORBE não viram orbita_* no MCP", () => {
    const orbeOnly = assistantTools().filter((t) => t.orbeOnly).map((t) => t.name);
    expect(orbeOnly).toEqual(expect.arrayContaining(["memoria", "pedir_a_agente", "status_agentes", "buscar_conversas"]));
  });
});

describe("projetos pela ORBE", () => {
  it("cria no espaço da conversa, não duplica e lista só o espaço", async () => {
    const db = await getDb();
    const { projects } = await import("@/db/schema");
    await db.delete(tasks);
    await db.delete(projects);
    const created = await runAssistantTool("criar_projeto", { nome: "IA econômica", descricao: "Usar Jev e modelos baratos nas partes leves." }, { scope: "empresa" });
    expect(created).toMatchObject({ ok: true, text: expect.stringContaining("criado em empresa") });
    const again = await runAssistantTool("criar_projeto", { nome: "ia econômica" }, { scope: "empresa" });
    expect(again.text).toContain("já existe");
    expect(await db.select().from(projects)).toHaveLength(1);
    expect((await runAssistantTool("listar_projetos", {}, { scope: "pessoal" })).text).toContain("Nenhum projeto");
    expect((await runAssistantTool("listar_projetos", {}, { scope: "empresa" })).text).toContain("IA econômica");
    const outro = await runAssistantTool("criar_projeto", { nome: "X", escopo: "pessoal" }, { scope: "empresa" });
    expect(outro.ok).toBe(false);
  });
});
