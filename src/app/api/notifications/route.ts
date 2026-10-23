import { isAuthenticated } from "@/lib/auth";
import { taskScope } from "@/lib/task-scope";
import { loadNotifications } from "@/server/notifications";

export async function GET(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const scope = taskScope(new URL(request.url).searchParams.get("escopo"));
  try {
    return Response.json({ items: await loadNotifications(scope), scope, checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Não foi possível atualizar os avisos." }, { status: 503 });
  }
}
