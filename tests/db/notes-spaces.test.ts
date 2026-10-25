import { beforeEach, expect, it } from "vitest";
import { getDb } from "@/db";
import { notes, projects } from "@/db/schema";
import { getNote, insertNote, listNotes, patchNote, removeNote } from "@/server/notes";
import { buscarNotas, runAssistantTool } from "@/server/assistant";
import { COMPANY_NOTE_TAG, noteHref } from "@/lib/note-scope";
import { listProjects } from "@/server/projects";

beforeEach(async () => { const db = await getDb(); await db.delete(notes); });

it("preserves old notes as personal and separates list, detail and search by workspace", async () => {
  const db = await getDb();
  const [legacy] = await db.insert(notes).values({ title: "Ideia pessoal antiga", content: "Contexto privado" }).returning();
  const company = await insertNote("Ideia da empresa", "Rascunho de trabalho", "empresa");
  expect((await listNotes()).map(note => note.id)).toEqual([legacy.id]);
  expect((await listNotes(undefined, "empresa")).map(note => note.id)).toEqual([company]);
  expect(await getNote(company)).toBeNull();
  expect(await getNote(legacy.id, "empresa")).toBeNull();
  expect((await buscarNotas.run({ busca: "Ideia", escopo: "empresa" })).text).toContain("Ideia da empresa");
  expect((await buscarNotas.run({ busca: "Ideia", escopo: "empresa" })).text).not.toContain("Contexto privado");
});

it("cannot change or delete a note from another workspace or move it through tags", async () => {
  const company = await insertNote("Empresa", "Manter", "empresa");
  await expect(patchNote(company, { content: "Errado" }, "pessoal")).rejects.toThrow("neste espaço");
  await expect(removeNote(company, "pessoal")).rejects.toThrow("neste espaço");
  await patchNote(company, { title: "Renomeada", pinned: true, tags: ["projeto"] }, "empresa");
  expect(await getNote(company, "empresa")).toMatchObject({ content: "Manter", pinned: true, tags: ["projeto", COMPANY_NOTE_TAG] });
  const personal = await insertNote("Pessoal", "Privado", "pessoal");
  await patchNote(personal, { tags: [COMPANY_NOTE_TAG] }, "pessoal");
  expect(await getNote(personal)).toMatchObject({ tags: [] });
});

it("ORBE uses the active workspace for notes and rejects an explicit different scope", async () => {
  const result = await runAssistantTool("criar_nota", { titulo: "Ideia registrada", conteudo: "Rascunho" }, { scope: "empresa" });
  expect(result.ok).toBe(true);
  expect((await listNotes(undefined, "empresa"))).toHaveLength(1);
  expect(await listNotes()).toHaveLength(0);
  expect((await buscarNotas.run({ busca: "Sem resultado", escopo: "empresa" })).text).toBe("Nenhuma nota da empresa encontrada.");
  expect((await runAssistantTool("buscar_notas", { busca: "Ideia", escopo: "pessoal" }, { scope: "empresa" })).ok).toBe(false);
  expect(noteHref("empresa", "note-id")).toBe("/notas?escopo=empresa&id=note-id");
});

it("project lists remain separate without requiring cross-workspace tabs", async () => {
  const db = await getDb();
  const inserted = await db.insert(projects).values([{ name: "Projeto pessoal", area: "estudos" }, { name: "Projeto empresa", area: "empresa" }]).returning();
  try {
    const personal = await listProjects(true, "pessoal");
    const company = await listProjects(true, "empresa");
    expect(personal.some(project => project.id === inserted[1].id)).toBe(false);
    expect(company.some(project => project.id === inserted[0].id)).toBe(false);
  } finally { for (const project of inserted) { const { eq } = await import("drizzle-orm"); await db.delete(projects).where(eq(projects.id, project.id)); } }
});
