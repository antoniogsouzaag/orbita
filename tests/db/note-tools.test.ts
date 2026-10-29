import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import { assistantTools, runAssistantTool } from "@/server/assistant";
import { archiveNote, getNote, insertNote, linkNoteProject, listNotes, noteVersion, patchNote } from "@/server/notes";

const company = { scope: "empresa" as const };
const read = (id: string, extra = {}) => runAssistantTool("consultar_nota", { id, ...extra }, { ...company, readOnly: true });
describe("notas completas e vínculo explícito de projeto", () => {
  it("lê páginas completas, identifica arquivo e protege contra continuação de versão antiga", async () => {
    const content = `${"x".repeat(6000)}Conclusão no final`;
    const id = await insertNote("Proposta longa", content, "empresa");
    const first = await read(id);
    expect(first.ok).toBe(true);
    expect(first.action).toBeUndefined();
    const a = JSON.parse(first.text);
    expect(a.conteudo.proximo_inicio).toBe(6000);
    expect((await read(id, { inicio: 6000 })).ok).toBe(false);
    const b = JSON.parse((await read(id, { inicio: 6000, versao: a.versao })).text);
    expect(a.conteudo.trecho + b.conteudo.trecho).toBe(content);
    expect(b.conteudo.proximo_inicio).toBeNull();
    await patchNote(id, { content: "Atualizada" }, "empresa");
    expect((await read(id, { inicio: 6000, versao: a.versao })).ok).toBe(false);
    await archiveNote(id, true, "empresa");
    expect(JSON.parse((await read(id)).text).arquivada).toBe(true);
    expect(JSON.parse((await read(id)).text).href).toContain("arquivo=1");
    expect((await listNotes(undefined, "empresa")).some(note => note.id === id)).toBe(false);
  });

  it("isola UUIDs e escopos e retira vínculo do modo somente leitura", async () => {
    const id = await insertNote("Privada", "sentinela-pessoal", "pessoal");
    expect((await read(id)).ok).toBe(false);
    expect((await read(id)).text).not.toContain("sentinela");
    expect((await read(id, { escopo: "pessoal" })).ok).toBe(false);
    expect(assistantTools("empresa", { readOnly: true }).some(t => t.name === "vincular_nota_projeto")).toBe(false);
    expect((await runAssistantTool("vincular_nota_projeto", { id, projeto_id: null, versao: "a".repeat(64) }, { ...company, readOnly: true })).ok).toBe(false);
    expect((await runAssistantTool("consultar_nota", { id }, { scope: "pessoal", readOnly: true })).text).toContain("sentinela-pessoal");
  });

  it("vincula e remove sem duplicar nem perder conteúdo, pin ou tags; concorrência recusa uma versão antiga", async () => {
    const db = await getDb();
    const [project] = await db.insert(projects).values({ name: "Piloto social", area: "empresa" }).returning();
    const id = await insertNote("Proposta", "Preservar conteúdo", "empresa");
    await patchNote(id, { pinned: true, tags: ["editorial", "p:anterior"] }, "empresa");
    const before = (await getNote(id, "empresa"))!;
    const result = await runAssistantTool("vincular_nota_projeto", { id, projeto_id: project.id, versao: noteVersion(before) }, company);
    expect(result.ok).toBe(true);
    expect(result.action?.href).toContain(`projeto=${project.id}`);
    const saved = (await getNote(id, "empresa"))!;
    expect(saved).toMatchObject({ content: before.content, title: before.title, pinned: true, tags: ["editorial", "escopo:empresa", `p:${project.id}`] });
    expect((await listNotes(undefined, "empresa", false, project.id)).map(n => n.id)).toContain(id);
    expect((await runAssistantTool("vincular_nota_projeto", { id, projeto_id: null, versao: noteVersion(before) }, company)).ok).toBe(false);
    const replay = await linkNoteProject(id, "empresa", project.id, noteVersion(saved));
    expect(replay.updatedAt).toEqual(saved.updatedAt);
    const removed = await linkNoteProject(id, "empresa", null, noteVersion(saved));
    expect(removed.tags).toEqual(["editorial", "escopo:empresa"]);
    const revision = noteVersion(removed);
    const settled = await Promise.allSettled([linkNoteProject(id, "empresa", project.id, revision), linkNoteProject(id, "empresa", project.id, revision)]);
    expect(settled.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(settled.filter(r => r.status === "rejected")).toHaveLength(1);
  });

  it("recusa projetos de outro espaço, arquivados e notas arquivadas antes de gravar", async () => {
    const db = await getDb();
    const ps = await db.insert(projects).values([{ name: "Casa", area: "pessoal" }, { name: "Arquivado", area: "empresa", archived: true }, { name: "Atual", area: "empresa" }]).returning();
    const id = await insertNote("Empresa", "Original", "empresa");
    const note = (await getNote(id, "empresa"))!;
    for (const p of ps.slice(0, 2)) {
      expect((await runAssistantTool("vincular_nota_projeto", { id, projeto_id: p.id, versao: noteVersion(note) }, company)).ok).toBe(false);
      expect((await runAssistantTool("criar_nota", { titulo: "Não criar", projeto_id: p.id }, company)).ok).toBe(false);
    }
    expect(await getNote(id, "empresa")).toEqual(note);
    const created = await runAssistantTool("criar_nota", { titulo: "Nota do piloto", conteudo: "Novo rascunho", projeto_id: ps[2].id }, company);
    expect(created.ok).toBe(true);
    expect(created.action?.href).toContain(`projeto=${ps[2].id}`);
    await archiveNote(id, true, "empresa");
    const archived = (await getNote(id, "empresa"))!;
    await expect(linkNoteProject(id, "empresa", ps[2].id, noteVersion(archived))).rejects.toThrow("ativa");
    expect(await getNote(id, "empresa")).toEqual(archived);
    await db.update(projects).set({ archived: true }).where(eq(projects.id, ps[2].id));
  });
});
