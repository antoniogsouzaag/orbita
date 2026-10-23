import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { TASK_SCOPES, TASK_STATUS, projects, tasks, type TaskScope } from "@/db/schema";
import { projectScope } from "@/lib/task-scope";

const uuid = z.string().uuid();
export const taskSchema = z.object({
  title: z.string().trim().min(1).max(500),
  notes: z.string().max(20000).nullable().optional(),
  projectId: uuid.nullable().optional(),
  parentId: uuid.nullable().optional(),
  status: z.enum(TASK_STATUS).optional(),
  scope: z.enum(TASK_SCOPES).optional(),
  priority: z.number().int().min(0).max(3).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

async function checkedProject(projectId: string | null | undefined, scope: TaskScope) {
  if (!projectId) return null;
  const db = await getDb();
  const [project] = await db.select({ area: projects.area }).from(projects).where(eq(projects.id, projectId));
  if (!project) throw new Error("Projeto não encontrado.");
  if (projectScope(project.area) !== scope) throw new Error("Escolha um projeto do mesmo espaço da tarefa.");
  return projectId;
}

/** Chamadores autenticam na fronteira: ações, captura pessoal e ferramentas da IA/MCP. */
export async function insertTask(data: z.input<typeof taskSchema>) {
  const v = taskSchema.parse(data);
  const db = await getDb();
  let scope: TaskScope = v.scope ?? "pessoal";
  let projectId = v.projectId ?? null;
  if (v.parentId) {
    const [parent] = await db.select().from(tasks).where(eq(tasks.id, v.parentId));
    if (!parent || parent.parentId) throw new Error("Selecione uma tarefa principal para adicionar a subtarefa.");
    if (v.scope && v.scope !== parent.scope) throw new Error("A subtarefa pertence ao mesmo espaço da tarefa principal.");
    scope = parent.scope;
    projectId = parent.projectId;
  }
  await checkedProject(projectId, scope);
  const [row] = await db.insert(tasks).values({ ...v, scope, projectId, completedAt: v.status === "done" ? new Date() : null }).returning({ id: tasks.id });
  return row.id;
}

export async function patchTask(id: string, patch: Partial<z.input<typeof taskSchema>>) {
  const taskId = uuid.parse(id);
  const v = taskSchema.partial().parse(patch);
  if (!Object.keys(v).length) return;
  const db = await getDb();
  const [current] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!current) throw new Error("Tarefa não encontrada.");
  const parentId = v.parentId === undefined ? current.parentId : v.parentId;
  let scope = v.scope ?? current.scope;
  let projectId = v.projectId === undefined ? current.projectId : v.projectId;
  if (parentId) {
    const [parent] = await db.select().from(tasks).where(eq(tasks.id, parentId));
    if (!parent || parent.id === taskId || parent.parentId) throw new Error("Selecione uma tarefa principal válida.");
    const [child] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.parentId, taskId)).limit(1);
    if (child) throw new Error("Uma tarefa com subtarefas precisa permanecer como tarefa principal.");
    if (v.scope && v.scope !== parent.scope) throw new Error("Mova a tarefa principal para alterar o espaço das subtarefas.");
    scope = parent.scope;
    projectId = parent.projectId;
  } else if (v.scope && v.scope !== current.scope && v.projectId === undefined && projectId) {
    const [project] = await db.select({ area: projects.area }).from(projects).where(eq(projects.id, projectId));
    if (!project || projectScope(project.area) !== scope) projectId = null;
  }
  // Um registro legado com vínculo inconsistente continua editável. Só validamos
  // um novo vínculo ou uma mudança explícita de espaço/parentesco.
  if ("projectId" in v || "scope" in v || "parentId" in v) await checkedProject(projectId, scope);
  const changes = { ...v, ...(scope !== current.scope ? { scope } : {}), ...(projectId !== current.projectId ? { projectId } : {}), ...(v.status ? { completedAt: v.status === "done" ? new Date() : null } : {}) };
  const update = db.update(tasks).set(changes).where(eq(tasks.id, taskId)).returning({ id: tasks.id });
  if (scope !== current.scope || projectId !== current.projectId) {
    // Uma única instrução é atômica também no driver HTTP do Neon. Apenas a
    // mudança explícita da tarefa principal se propaga, sem reclassificar a base.
    await db.execute(sql`with recursive family as (
      select ${tasks.id} from ${tasks} where ${tasks.id} = ${taskId}
      union select child.id from ${tasks} child join family on child.parent_id = family.id
    ), changed as (${update.getSQL()})
    update ${tasks} set scope = ${scope}, project_id = ${projectId}
    where ${and(sql`${tasks.id} in (select id from family)`, sql`${tasks.id} <> ${taskId}`)}`);
  } else await update;
}
