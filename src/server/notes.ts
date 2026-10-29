import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb, withDbTransaction } from "@/db";
import { notes, projects, type Note, type TaskScope } from "@/db/schema";
import { getProject } from "./projects";
import { projectScope } from "@/lib/task-scope";
import { ARCHIVED_NOTE_TAG, COMPANY_NOTE_TAG, noteTags } from "@/lib/note-scope";

export function noteScopeCondition(scope: TaskScope) {
  const company = sql`${COMPANY_NOTE_TAG} = any(${notes.tags})`;
  return scope === "empresa" ? company : sql`not (${company})`;
}

export function noteArchiveCondition(archived = false) {
  const condition = sql`${ARCHIVED_NOTE_TAG} = any(${notes.tags})`;
  return archived ? condition : sql`not (${condition})`;
}

export async function listNotes(q?: string, scope: TaskScope = "pessoal", archived = false, projectId?: string) {
  const db = await getDb();
  return db
    .select()
    .from(notes)
    .where(and(noteScopeCondition(scope), noteArchiveCondition(archived), projectId ? sql`${`p:${projectId}`} = any(${notes.tags})` : undefined, q ? or(ilike(notes.title, `%${q}%`), ilike(notes.content, `%${q}%`)) : undefined))
    .orderBy(desc(notes.pinned), desc(notes.updatedAt))
    .limit(300);
}

export async function getNote(id: string, scope: TaskScope = "pessoal") {
  const db = await getDb();
  const [n] = await db.select().from(notes).where(and(eq(notes.id, id), noteScopeCondition(scope)));
  return n ?? null;
}

export function noteVersion(note: Note) {
  return createHash("sha256").update(JSON.stringify([note.id, note.title, note.content, note.tags, note.pinned, note.updatedAt.toISOString()])).digest("hex");
}

/** Link existing work without copying it or overwriting concurrent edits. */
export async function linkNoteProject(id: string, scope: TaskScope, projectId: string | null, version: string) {
  return withDbTransaction(async (db) => {
    const [note] = await db.select().from(notes).where(and(eq(notes.id, id), noteScopeCondition(scope))).for("update");
    if (!note || note.tags.includes(ARCHIVED_NOTE_TAG)) throw new Error("Nota ativa não encontrada neste espaço.");
    if (noteVersion(note) !== version) throw new Error("A nota mudou. Releia antes de vincular.");
    if (projectId) {
      const [project] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.archived, false), scope === "empresa" ? eq(projects.area, "empresa") : sql`${projects.area} <> 'empresa'`)).for("share");
      if (!project) throw new Error("Projeto ativo não encontrado neste espaço.");
    }
    const tags = note.tags.filter(tag => !tag.startsWith("p:"));
    if (projectId) tags.push(`p:${projectId}`);
    if (JSON.stringify(tags) === JSON.stringify(note.tags)) return note;
    const [updated] = await db.update(notes).set({ tags, updatedAt: new Date() }).where(eq(notes.id, id)).returning();
    return updated;
  });
}

export async function insertNote(title: string, content: string, scope: TaskScope, projectId?: string) {
  if (projectId) {
    const project = await getProject(projectId);
    if (!project || project.archived || projectScope(project.area) !== scope) throw new Error("Projeto ativo não encontrado neste espaço.");
  }
  const db = await getDb();
  const [row] = await db.insert(notes).values({ title, content, tags: noteTags(projectId ? [`p:${projectId}`] : [], scope) }).returning({ id: notes.id });
  return row.id;
}

export async function patchNote(id: string, data: { title?: string; content?: string; pinned?: boolean; tags?: string[] }, scope: TaskScope) {
  const db = await getDb();
  const [row] = await db.update(notes).set({ ...data, ...(data.tags ? { tags: noteTags(data.tags, scope) } : {}), updatedAt: new Date() })
    .where(and(eq(notes.id, id), noteScopeCondition(scope))).returning({ id: notes.id });
  if (!row) throw new Error("Nota não encontrada neste espaço.");
}

export async function removeNote(id: string, scope: TaskScope) {
  const db = await getDb();
  const [row] = await db.delete(notes).where(and(eq(notes.id, id), noteScopeCondition(scope))).returning({ id: notes.id });
  if (!row) throw new Error("Nota não encontrada neste espaço.");
}

export async function archiveNote(id: string, archived: boolean, scope: TaskScope) {
  const db = await getDb();
  const tags = archived
    ? sql`array_append(array_remove(${notes.tags}, ${ARCHIVED_NOTE_TAG}), ${ARCHIVED_NOTE_TAG})`
    : sql`array_remove(${notes.tags}, ${ARCHIVED_NOTE_TAG})`;
  const [row] = await db.update(notes).set({ tags, updatedAt: new Date() })
    .where(and(eq(notes.id, id), noteScopeCondition(scope))).returning({ id: notes.id });
  if (!row) throw new Error("Nota não encontrada neste espaço.");
}
