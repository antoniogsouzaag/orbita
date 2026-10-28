import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { tasks } from "@/db/schema";
import { createAgentToken } from "@/server/agents";
import { proposalSource, saveProposalReply } from "@/server/proposals";
import { ANSWERED_TAG, awaitsOwner, latestReplyAt } from "@/lib/proposals";

const { githubInbox } = vi.hoisted(() => ({ githubInbox: vi.fn() }));
vi.mock("@/server/github-inbox", () => ({ githubInbox, githubProposalBody: vi.fn(async () => "Corpo da proposta") }));
const item = { kind: "proposta" as const, stage: "decision" as const, repo: "barberias", number: 94, title: "Política de mídia", url: "https://github.com/aglabs-core/barberias/issues/94", updatedAt: "2026-10-24T12:00:00Z", author: "agente" };
const input = () => ({ source: { kind: "github" as const, repo: "barberias", number: 94 }, requestId: randomUUID(), message: "Pode continuar com a revisão e registrar a evidência.", agent: "tom" });

describe("respostas de propostas e continuidade", () => {
  beforeAll(async () => { await createAgentToken("Tom", ["tarefas"]); await createAgentToken("Somente status", ["status"]); });
  beforeEach(async () => { const db = await getDb(); await db.delete(tasks); githubInbox.mockResolvedValue({ error: null, stale: false, org: "aglabs-core", items: [item] }); });

  it("cria uma tarefa empresarial por origem, mantém histórico e deduplica reenvios", async () => {
    const first = input();
    const result = await saveProposalReply(first);
    await saveProposalReply(first);
    const db = await getDb();
    let rows = await db.select().from(tasks);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: result.id, scope: "empresa", status: "todo" });
    expect(rows[0].tags).toContain("agente:tom");
    expect(rows[0].notes?.match(/Resposta de Antonio/g)).toHaveLength(1);
    expect(rows[0].notes).toContain(item.url);
    expect(awaitsOwner(item, rows)).toBe(false);
    expect(awaitsOwner({ ...item, updatedAt: new Date(Date.parse(latestReplyAt(rows[0].notes)!) + 1000).toISOString() }, rows)).toBe(true);
    await db.update(tasks).set({ status: "done", completedAt: new Date() }).where(eq(tasks.id, result.id));
    await saveProposalReply(first);
    rows = await db.select().from(tasks);
    expect(rows[0].status).toBe("done"); // Retry antigo não reabre trabalho concluído.
    const second = await saveProposalReply({ ...input(), message: "Mais um ajuste antes de concluir." });
    expect(second.id).toBe(result.id);
    rows = await db.select().from(tasks);
    expect(rows[0].status).toBe("todo");
    expect(rows[0].completedAt).toBeNull();
    expect(rows[0].notes?.match(/Resposta de Antonio/g)).toHaveLength(2);
  });

  it("respostas concorrentes não perdem mensagens nem criam tarefas duplicadas", async () => {
    await Promise.all([saveProposalReply({ ...input(), message: "Primeira orientação." }), saveProposalReply({ ...input(), message: "Segunda orientação." })]);
    const db = await getDb();
    const rows = await db.select().from(tasks);
    expect(rows).toHaveLength(1);
    expect(rows[0].notes).toContain("Primeira orientação.");
    expect(rows[0].notes).toContain("Segunda orientação.");
  });

  it("mantém decisões de repositórios homônimos separadas por proprietário", async () => {
    const org = { ...item, repo: "orbita", url: "https://github.com/aglabs-core/orbita/issues/94" };
    const personal = { ...item, repo: "antoniogsouzaag/orbita", url: "https://github.com/antoniogsouzaag/orbita/issues/94" };
    githubInbox.mockResolvedValue({ error: null, stale: false, org: "aglabs-core", items: [org, personal] });
    const first = await saveProposalReply({ ...input(), source: { kind: "github", repo: "orbita", number: 94 } });
    const second = await saveProposalReply({ ...input(), source: { kind: "github", repo: "antoniogsouzaag/orbita", number: 94 } });
    expect(first.id).not.toBe(second.id);
    const db = await getDb();
    const rows = await db.select().from(tasks);
    expect(rows).toHaveLength(2);
    expect(rows.find(row => row.id === first.id)?.notes).toContain(org.url);
    expect(rows.find(row => row.id === second.id)?.notes).toContain(personal.url);
    expect(await proposalSource({ kind: "github", repo: "outro/orbita", number: 94 })).toBeNull();
  });

  it("pedido local preserva detalhes e vínculos e fica atribuído ao agente para continuidade", async () => {
    const db = await getDb();
    const [task] = await db.insert(tasks).values({ title: "Escolher abordagem", notes: "Contexto original", scope: "empresa", priority: 3, tags: ["agente:tom", "barberias"] }).returning();
    const result = await saveProposalReply({ ...input(), source: { kind: "task", id: task.id } });
    expect(result.id).toBe(task.id);
    const [saved] = await db.select().from(tasks).where(eq(tasks.id, task.id));
    expect(saved.notes).toContain("Contexto original");
    expect(saved.notes).toContain("Pode continuar");
    expect(saved.priority).toBe(3);
    expect(saved.tags).toEqual(["barberias", "agente:tom", ANSWERED_TAG]);
  });

  it("recusa tarefa pessoal, tarefa sem agente, agente sem acesso e GitHub indisponível", async () => {
    const db = await getDb();
    for (const task of [{ title: "Pessoal", scope: "pessoal" as const, tags: ["agente:tom"] }, { title: "Empresa", scope: "empresa" as const, tags: [] }]) {
      const [row] = await db.insert(tasks).values(task).returning();
      await expect(saveProposalReply({ ...input(), source: { kind: "task", id: row.id } })).rejects.toThrow("Proposta não encontrada");
      expect(await proposalSource({ kind: "task", id: row.id })).toBeNull();
    }
    await expect(saveProposalReply({ ...input(), agent: "somente-status" })).rejects.toThrow("acesso ativo");
    await expect(saveProposalReply({ ...input(), source: { kind: "github", repo: "outro", number: 94 } })).rejects.toThrow("Proposta não encontrada");
    githubInbox.mockResolvedValue({ error: "indisponível", items: [item] });
    await expect(saveProposalReply(input())).rejects.toThrow("GitHub indisponível");
    expect(await db.select().from(tasks).where(and(eq(tasks.scope, "empresa"), eq(tasks.title, "Retomar proposta: Política de mídia")))).toHaveLength(0);
  });
});
