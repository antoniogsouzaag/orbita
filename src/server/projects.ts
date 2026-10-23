import "server-only";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { projects, tasks, type TaskScope } from "@/db/schema";

export async function listProjects(includeArchived = false, scope?: TaskScope) {
  const db = await getDb();
  const rows = await db
    .select({
      project: projects,
      open: sql<number>`count(${tasks.id}) filter (where ${tasks.status} <> 'done' and ${tasks.parentId} is null)::int`,
      done: sql<number>`count(${tasks.id}) filter (where ${tasks.status} = 'done' and ${tasks.parentId} is null)::int`,
    })
    .from(projects)
    .leftJoin(tasks, and(eq(tasks.projectId, projects.id), scope ? eq(tasks.scope, scope) : sql`${tasks.scope} = case when ${projects.area} = 'empresa' then 'empresa' else 'pessoal' end`))
    .where(and(includeArchived ? undefined : eq(projects.archived, false), scope === "empresa" ? eq(projects.area, "empresa") : scope === "pessoal" ? ne(projects.area, "empresa") : undefined))
    .groupBy(projects.id)
    .orderBy(asc(projects.archived), asc(projects.sort), asc(projects.name));
  return rows.map((r) => ({ ...r.project, open: r.open, done: r.done }));
}

export type ProjectWithCounts = Awaited<ReturnType<typeof listProjects>>[number];

export async function getProject(id: string) {
  const db = await getDb();
  const [p] = await db.select().from(projects).where(eq(projects.id, id));
  return p ?? null;
}
