import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getDb } from "@/db";
import { focusSessions, goals, notes, projects, tasks } from "@/db/schema";
import { allTags, completedOnDays, getTask, homeTasks, listTasks, taskCounts } from "@/server/tasks";
import { listProjects } from "@/server/projects";
import { focusStats } from "@/server/life";
import { today } from "@/lib/dates";
import { assistantTools, quickTask, runAssistantTool } from "@/server/assistant";
import { empresaContext, personalContext } from "@/server/ai";
import { createTask, quickAddTask, updateTask } from "@/app/actions/core";
import { logFocus } from "@/app/actions/life";
import { GET as search } from "@/app/api/search/route";
vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn(), isAuthenticated: vi.fn(() => true) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/vault", () => ({ searchVault: vi.fn(async () => []), getVaultProvider: vi.fn(() => null) }));

let personalProject: string, companyProject: string, personal: string, company: string;
beforeAll(async () => {
  const db = await getDb();
  const ps = await db.insert(projects).values([{ name: "Projeto casa", area: "pessoal" }, { name: "Produto oficial", area: "empresa" }]).returning();
  personalProject = ps[0].id; companyProject = ps[1].id;
  personal = await createTask({ title: "Espaço pessoal", tags: ["casa"], projectId: personalProject, scope: "pessoal" });
  company = await createTask({ title: "Espaço empresa", tags: ["operacao"], projectId: companyProject, scope: "empresa" });
});

describe("tarefas isoladas por espaço", () => {
  it("listas, contagens, filtros e detalhes não atravessam o espaço", async () => {
    expect((await listTasks({ scope: "pessoal" })).map((task) => task.id)).toEqual([personal]);
    expect((await homeTasks(10, "empresa")).map((task) => task.id)).toEqual([company]);
    expect((await taskCounts("empresa")).open).toBe(1);
    expect(await allTags("pessoal")).toEqual(["casa"]);
    expect(await allTags("empresa")).toEqual(["operacao"]);
    expect(await getTask(personal, "empresa")).toBeNull();
    expect(await getTask(company, "pessoal")).toBeNull();
    expect(await getTask(company, "empresa", personalProject)).toBeNull();
    expect(await getTask("id-inválido", "pessoal")).toBeNull();
    expect((await listProjects(false, "pessoal")).map((project) => project.id)).toEqual([personalProject]);
    expect((await listProjects(false, "empresa")).map((project) => project.id)).toEqual([companyProject]);
  });

  it("novas subtarefas herdam espaço e projeto; mudança explícita move a família atomicamente", async () => {
    const child = await createTask({ title: "Detalhe interno", parentId: company });
    const db = await getDb();
    expect((await db.select().from(tasks).where(eq(tasks.id, child)))[0]).toMatchObject({ scope: "empresa", projectId: companyProject });
    await expect(createTask({ title: "Filha incoerente", parentId: company, scope: "pessoal" })).rejects.toThrow("mesmo espaço");
    await expect(updateTask(child, { scope: "pessoal" })).rejects.toThrow("tarefa principal");
    await updateTask(company, { scope: "pessoal", title: "Movida explicitamente" });
    expect((await db.select().from(tasks).where(eq(tasks.id, child)))[0]).toMatchObject({ scope: "pessoal", projectId: null, title: "Detalhe interno" });
    expect((await db.select().from(tasks).where(eq(tasks.id, company)))[0]).toMatchObject({ scope: "pessoal", projectId: null, title: "Movida explicitamente" });
    await updateTask(company, { scope: "empresa", projectId: companyProject });
    expect((await getTask(company, "empresa"))?.children).toHaveLength(1);
  });

  it("não infere empresa a partir de tag ou nome e recusa projeto incompatível", async () => {
    const result = await quickAddTask("Nome da empresa #barberias @Produto oficial", null, "pessoal");
    const db = await getDb();
    expect((await db.select().from(tasks).where(eq(tasks.id, result.id)))[0]).toMatchObject({ scope: "pessoal", projectId: null });
    await expect(createTask({ title: "Incompatível", scope: "pessoal", projectId: companyProject })).rejects.toThrow("mesmo espaço");
    await expect(updateTask(personal, { projectId: companyProject })).rejects.toThrow("mesmo espaço");
  });

  it("busca global respeita espaço e devolve links corretos sem notas pessoais na Empresa", async () => {
    const db = await getDb();
    await db.insert(notes).values({ title: "Espaço nota pessoal", content: "privado" });
    await db.insert(goals).values([{ title: "Espaço meta pessoal", area: "pessoal" }, { title: "Espaço meta empresa", area: "empresa" }]);
    const companyResult = await (await search(new NextRequest("https://orbita.test/api/search?q=Espaço&escopo=empresa"))).json();
    expect(companyResult.results.some((result: { type: string }) => result.type === "nota")).toBe(false);
    expect(companyResult.results.some((result: { title: string }) => result.title === "Espaço meta pessoal")).toBe(false);
    const own = await (await search(new NextRequest("https://orbita.test/api/search?q=Espaço"))).json();
    expect(own.results.some((result: { title: string }) => result.title === "Espaço meta empresa")).toBe(false);
    const companyTasks = await (await search(new NextRequest("https://orbita.test/api/search?q=Movida&escopo=empresa"))).json();
    expect(companyTasks.results.find((result: { type: string }) => result.type === "tarefa")?.href).toBe(`/tarefas?escopo=empresa&task=${company}`);
    expect((await (await search(new NextRequest("https://orbita.test/api/search?q=Movida"))).json()).results).toEqual([]);
  });

  it("contextos da IA mantêm tarefas e indicadores no espaço correspondente", async () => {
    await updateTask(personal, { dueDate: today() });
    const companyText = await empresaContext();
    const personalText = await personalContext();
    expect(companyText).toContain("Movida explicitamente");
    expect(companyText).not.toContain("Espaço pessoal");
    expect(companyText).not.toContain("Espaço nota pessoal");
    expect(personalText).toContain("Espaço pessoal");
    expect(personalText).not.toContain("Movida explicitamente");
  });

  it("IA e captura usam o espaço real e recusam escrita cruzada", async () => {
    const captured = await quickTask("Revisar canais @Produto oficial");
    expect(captured.action?.href).toBe("/tarefas?escopo=empresa");
    expect((await runAssistantTool("listar_tarefas", {})).text).not.toContain("Revisar canais");
    expect((await runAssistantTool("listar_tarefas", {}, { scope: "empresa" })).text).toContain("Revisar canais");
    const rejected = await runAssistantTool("atualizar_tarefa", { id: personal, titulo: "Vazou" }, { scope: "empresa" });
    expect(rejected.ok).toBe(false);
    expect((await runAssistantTool("criar_tarefa", { titulo: "Incoerente", projeto: "Produto oficial", escopo: "pessoal" })).ok).toBe(false);
    const created = await runAssistantTool("criar_tarefa", { titulo: "Criada no contexto empresa" }, { scope: "empresa" });
    expect(created.action?.href).toBe("/tarefas?escopo=empresa");
    expect(assistantTools("empresa").some((tool) => tool.name === "buscar_notas")).toBe(false);
    expect(assistantTools("empresa").some((tool) => tool.name === "registrar_lancamento")).toBe(false);
    expect(assistantTools("empresa").some((tool) => tool.name === "ver_agenda")).toBe(false);
    expect(assistantTools("empresa").some((tool) => tool.name === "criar_evento")).toBe(false);
    expect((await runAssistantTool("ver_agenda", {}, { scope: "empresa" })).ok).toBe(false);
  });

  it("Foco separa tarefas, sessões e valida o vínculo empresarial", async () => {
    await logFocus(5, "Sessão pessoal", personal);
    await logFocus(8, "Sessão empresa", company, undefined, undefined, "empresa");
    await logFocus(3, "Foco livre");
    await expect(logFocus(2, "Cruzada", personal, undefined, undefined, "empresa")).rejects.toThrow("deste espaço");
    await expect(logFocus(2, null, null, undefined, undefined, "empresa")).rejects.toThrow("Vincule");
    expect((await focusStats("pessoal")).today).toBe(8);
    expect((await focusStats("empresa")).today).toBe(8);
    expect((await focusStats("empresa")).recent.map((session) => session.label)).toEqual(["Sessão empresa"]);
    expect(await (await getDb()).select().from(focusSessions)).toHaveLength(3);
  });

  it("subtarefa legada com default pessoal permanece na origem explícita do pai sem regravar a base", async () => {
    const db = await getDb();
    const [legacy] = await db.insert(tasks).values({ title: "Subtarefa antiga", parentId: company, scope: "pessoal", status: "done", completedAt: new Date() }).returning();
    expect((await getTask(company, "empresa"))?.children.find((task) => task.id === legacy.id)?.scope).toBe("empresa");
    expect((await completedOnDays(today(), "pessoal")).some((task) => task.id === legacy.id)).toBe(false);
    expect((await completedOnDays(today(), "empresa")).some((task) => task.id === legacy.id)).toBe(true);
    expect((await db.select().from(tasks).where(eq(tasks.id, legacy.id)))[0].scope).toBe("pessoal");
  });
});
