import { isAuthenticated } from "@/lib/auth";
import { loadNotifications } from "@/server/notifications";

export async function GET() {
  if (!(await isAuthenticated())) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    return Response.json({ items: await loadNotifications(), checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Não foi possível atualizar os avisos." }, { status: 503 });
  }
}
