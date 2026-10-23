import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { projects, tasks } from "@/db/schema";

export async function listProjects(includeArchived = false) {
  const db = await getDb();
  const rows = await db
    .select({
      project: projects,
      open: sql<number>`count(${tasks.id}) filter (where ${tasks.status} <> 'done' and ${tasks.parentId} is null)::int`,
      done: sql<number>`count(${tasks.id}) filter (where ${tasks.status} = 'done' and ${tasks.parentId} is null)::int`,
    })
    .from(projects)
    .leftJoin(tasks, eq(tasks.projectId, projects.id))
    .where(includeArchived ? undefined : eq(projects.archived, false))
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
