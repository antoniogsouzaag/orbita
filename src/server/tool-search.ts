import "server-only";
import { and, desc, eq, ilike, ne, or } from "drizzle-orm";
import { getDb } from "@/db";
import { tasks, projects, notes, type TaskScope } from "@/db/schema";
import { AGENT_MANUAL_SECTIONS } from "@/lib/agent-handbook";
import { noteArchiveCondition, noteScopeCondition } from "./notes";
import { getVaultProvider, searchVault, vaultHealth } from "./vault";

/** Cada fonte declara cobertura; falha nunca vira ausência de resultados. */
export async function searchKnowledge(consulta: string, options: { scope?: TaskScope; internal?: boolean; source?: "todos" | "documentacao" | "vault" | "tarefas" | "projetos" | "notas" } = {}) {
  const source = options.source ?? "todos";
  const scope = options.scope ?? "pessoal";
  const wanted = (name: string) => source === "todos" || source === name;
  const jobs: { source: string; run: () => Promise<unknown> }[] = [];
  if (wanted("documentacao")) jobs.push({ source: "documentacao", run: async () => {
    const terms = consulta.toLocaleLowerCase("pt-BR").split(/\s+/);
    return AGENT_MANUAL_SECTIONS.filter(s => terms.every(t => `${s.title} ${s.body}`.toLocaleLowerCase("pt-BR").includes(t))).slice(0, 8).map(s => ({ title: s.title, href: `/documentacao#${s.id}`, snippet: s.body.slice(0, 700) }));
  } });
  if (wanted("vault")) jobs.push({ source: "vault", run: async () => {
    if (!getVaultProvider() || !(await vaultHealth()).ok) throw new Error("Vault indisponível ou não configurado");
    return searchVault(consulta, 8);
  } });
  if (!options.internal && ["tarefas", "projetos", "notas"].includes(source)) throw new Error("Fonte exige acesso administrativo");
  if (options.internal) {
    const like = `%${consulta.replace(/[\\%_]/g, "\\$&")}%`;
    if (wanted("tarefas")) jobs.push({ source: "tarefas", run: async () => (await getDb()).select({ id: tasks.id, title: tasks.title, status: tasks.status }).from(tasks).where(and(eq(tasks.scope, scope), or(ilike(tasks.title, like), ilike(tasks.notes, like)))).orderBy(desc(tasks.createdAt), desc(tasks.id)).limit(8) });
    if (wanted("projetos")) jobs.push({ source: "projetos", run: async () => (await getDb()).select({ id: projects.id, title: projects.name }).from(projects).where(and(eq(projects.archived, false), scope === "empresa" ? eq(projects.area, "empresa") : ne(projects.area, "empresa"), or(ilike(projects.name, like), ilike(projects.description, like)))).orderBy(desc(projects.createdAt), desc(projects.id)).limit(8) });
    if (wanted("notas")) jobs.push({ source: "notas", run: async () => (await getDb()).select({ id: notes.id, title: notes.title }).from(notes).where(and(noteScopeCondition(scope), noteArchiveCondition(), or(ilike(notes.title, like), ilike(notes.content, like)))).orderBy(desc(notes.updatedAt), desc(notes.id)).limit(8) });
  }
  const results = await Promise.allSettled(jobs.map(j => j.run()));
  return { consulta, escopo: options.internal ? scope : "contexto", limite_por_fonte: 8, cobertura: "Busca limitada às fontes listadas; até 8 resultados por fonte. Refine a consulta. CRM, conversas e status ao vivo usam ferramentas próprias.", fontes: results.map((r, i) => r.status === "fulfilled" ? { fonte: jobs[i].source, status: "ok", resultados: r.value } : { fonte: jobs[i].source, status: "indisponivel", resultados: null }) };
}
