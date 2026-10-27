import type { TaskScope } from "@/db/schema";

/** Marcador reservado e explícito; notas anteriores continuam pessoais. */
export const COMPANY_NOTE_TAG = "escopo:empresa";
export const ARCHIVED_NOTE_TAG = "estado:arquivada";
export function noteTags(tags: string[], scope: TaskScope): string[] {
  const clean = tags.filter(tag => tag !== COMPANY_NOTE_TAG);
  return scope === "empresa" ? [...clean, COMPANY_NOTE_TAG] : clean;
}
export function noteHref(scope: TaskScope, id?: string, archived = false, projectId?: string): string {
  const query = new URLSearchParams();
  if (scope === "empresa") query.set("escopo", "empresa");
  if (projectId) query.set("projeto", projectId);
  if (id) query.set("id", id);
  if (archived) query.set("arquivo", "1");
  return `/notas${query.size ? `?${query}` : ""}`;
}
