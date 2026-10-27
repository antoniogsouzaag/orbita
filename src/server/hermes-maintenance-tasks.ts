import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { tasks, type Task } from "@/db/schema";

/** Não reivindica nem encerra: esse ciclo pertence ao executor autenticado via MCP. */
export async function validateMaintenanceTask(id: string) {
 const db = await getDb();
 const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
 assertMaintenanceTask(task);
}
export function assertMaintenanceTask(task: Task | undefined) {
 if (!task || task.scope !== "empresa" || task.status === "done" || (task.assignee !== null && task.assignee !== "Hermes Oracle")) throw new Error("Selecione uma tarefa empresarial aberta, livre ou do Hermes Oracle.");
}
