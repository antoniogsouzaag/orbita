import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { projects, tasks, type Task, type TaskScope } from "@/db/schema";
import { shiftDate, today } from "@/lib/dates";

export type TaskRow = Task & {
  project: { id: string; name: string; color: string } | null;
  subtasks: { total: number; done: number };
};

export type TaskView = "hoje" | "proximos" | "atrasadas" | "semdata" | "todas" | "concluidas";

async function withMeta(rows: { task: Task; project: { id: string; name: string; color: string } | null }[]): Promise<TaskRow[]> {
  const db = await getDb();
  const ids = rows.map((r) => r.task.id);
  const counts = ids.length
    ? await db
        .select({
          parentId: tasks.parentId,
          total: sql<number>`count(*)::int`,
          done: sql<number>`count(*) filter (where ${tasks.status} = 'done')::int`,
        })
        .from(tasks)
        .where(inArray(tasks.parentId, ids))
        .groupBy(tasks.parentId)
    : [];
  const map = new Map(counts.map((c) => [c.parentId, { total: c.total, done: c.done }]));
  return rows.map((r) => ({ ...r.task, project: r.project?.id ? r.project : null, subtasks: map.get(r.task.id) ?? { total: 0, done: 0 } }));
}

const projectCols = { id: projects.id, name: projects.name, color: projects.color };

export async function listTasks(opts: { view?: TaskView; projectId?: string; tag?: string; limit?: number; scope?: TaskScope } = {}): Promise<TaskRow[]> {
  if (opts.projectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(opts.projectId)) return [];
  const db = await getDb();
  const t = today();
  const where = [isNull(tasks.parentId)];
  const view = opts.view ?? "todas";
  if (view === "concluidas") where.push(eq(tasks.status, "done"));
  else where.push(ne(tasks.status, "done"));
  if (view === "hoje") where.push(lte(tasks.dueDate, t));
  if (view === "atrasadas") where.push(lt(tasks.dueDate, t));
  if (view === "proximos") where.push(and(gte(tasks.dueDate, shiftDate(t, 1)), lte(tasks.dueDate, shiftDate(t, 14)))!);
  if (view === "semdata") where.push(isNull(tasks.dueDate));
  if (opts.projectId) where.push(eq(tasks.projectId, opts.projectId));
  if (opts.tag) where.push(sql`${opts.tag} = any(${tasks.tags})`);
  if (opts.scope) where.push(eq(tasks.scope, opts.scope));

  const order =
    view === "concluidas"
      ? [desc(tasks.completedAt)]
      : [sql`${tasks.dueDate} asc nulls last`, desc(tasks.priority), asc(tasks.sort), desc(tasks.createdAt)];

  const rows = await db
    .select({ task: tasks, project: projectCols })
    .from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(...where))
    .orderBy(...order)
    .limit(opts.limit ?? 500);
  return withMeta(rows);
}

export async function getTask(id: string, scope?: TaskScope, projectId?: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const db = await getDb();
  const [row] = await db.select({ task: tasks, project: projectCols }).from(tasks).leftJoin(projects, eq(tasks.projectId, projects.id)).where(and(eq(tasks.id, id), scope ? eq(tasks.scope, scope) : undefined, projectId ? eq(tasks.projectId, projectId) : undefined, isNull(tasks.parentId)));
  if (!row) return null;
  const [withCounts] = await withMeta([row]);
  const subtasks = await db.select().from(tasks).where(eq(tasks.parentId, id)).orderBy(asc(tasks.sort), asc(tasks.createdAt));
  // O vínculo explícito com a tarefa principal define a origem de subtarefas
  // antigas, inclusive as que foram gravadas com o default pessoal.
  return { ...withCounts, children: subtasks.map((child) => ({ ...child, scope: row.task.scope, projectId: row.task.projectId })) };
}

export async function taskCounts(scope?: TaskScope) {
  const db = await getDb();
  const t = today();
  const [c] = await db
    .select({
      open: sql<number>`count(*) filter (where ${tasks.status} <> 'done')::int`,
      today: sql<number>`count(*) filter (where ${tasks.status} <> 'done' and ${tasks.dueDate} = ${t})::int`,
      overdue: sql<number>`count(*) filter (where ${tasks.status} <> 'done' and ${tasks.dueDate} < ${t})::int`,
      doneToday: sql<number>`count(*) filter (where ${tasks.status} = 'done' and ${tasks.completedAt} >= now() - interval '24 hours')::int`,
    })
    .from(tasks)
    .where(scope ? and(isNull(tasks.parentId), eq(tasks.scope, scope)) : isNull(tasks.parentId));
  return c;
}

/** Widget "Tarefas": atrasadas e de hoje primeiro, depois o restante aberto. */
export async function homeTasks(limit = 6, scope?: TaskScope) {
  const db = await getDb();
  const t = today();
  const rows = await db
    .select({ task: tasks, project: projectCols })
    .from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(isNull(tasks.parentId), ne(tasks.status, "done"), scope ? eq(tasks.scope, scope) : undefined))
    .orderBy(
      sql`case when ${tasks.dueDate} <= ${t} then 0 when ${tasks.dueDate} is not null then 1 else 2 end`,
      sql`${tasks.dueDate} asc nulls last`,
      desc(tasks.priority),
      desc(tasks.createdAt),
    )
    .limit(limit);
  return withMeta(rows);
}

export async function allTags(scope?: TaskScope): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select({ tag: sql<string>`distinct unnest(${tasks.tags})` }).from(tasks).where(and(isNull(tasks.parentId), scope ? eq(tasks.scope, scope) : undefined));
  return rows.map((r) => r.tag).sort();
}

export async function completedOnDays(from: string, scope?: TaskScope) {
  const db = await getDb();
  return db
    .select({ id: tasks.id, completedAt: tasks.completedAt })
    .from(tasks)
    .where(and(eq(tasks.status, "done"), isNotNull(tasks.completedAt), gte(tasks.completedAt, new Date(`${from}T00:00:00Z`)), scope ? sql`coalesce((select parent.scope from ${tasks} parent where parent.id = ${tasks.parentId}), ${tasks.scope}) = ${scope}` : undefined));
}
