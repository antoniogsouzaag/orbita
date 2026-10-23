import type { TaskScope } from "@/db/schema";

/** O espaço é explícito. Tags e nomes não alteram a classificação. */
export function taskScope(value?: string | null): TaskScope {
  return value === "empresa" ? "empresa" : "pessoal";
}

export function projectScope(area: string): TaskScope {
  return area === "empresa" ? "empresa" : "pessoal";
}

export function taskHref(scope: TaskScope, id?: string) {
  const query = new URLSearchParams();
  if (scope === "empresa") query.set("escopo", scope);
  if (id) query.set("task", id);
  return `/tarefas${query.size ? `?${query}` : ""}`;
}
