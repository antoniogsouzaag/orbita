import { isAuthenticated } from "@/lib/auth";
import { taskScope } from "@/lib/task-scope";
import { feedbackForNotifications } from "@/server/crm-feedback";
import { feedbackTaskTitle } from "@/lib/crm-feedback";
import { loadNotifications } from "@/server/notifications";

export async function GET(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const scope = taskScope(new URL(request.url).searchParams.get("escopo"));
  try {
    const [local, feedback] = await Promise.all([
      loadNotifications(scope),
      scope === "empresa" ? feedbackForNotifications() : Promise.resolve(null),
    ]);
    const feedbackNotices = feedback?.status === "ok" ? feedback.items.filter(item => item.status === "novo").map(item => ({
      id: `feedback-${item.id}`, title: feedbackTaskTitle(item), detail: "Novo feedback de usuário",
      href: `/empresa/feedback?produto=${encodeURIComponent(item.produto)}&status=novo`, tone: "info" as const,
    })) : [];
    return Response.json({ items: [...feedbackNotices, ...local], feedbackUnavailable: feedback?.status === "unavailable", scope, checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Não foi possível atualizar os avisos." }, { status: 503 });
  }
}
