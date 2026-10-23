import "server-only";
import type { TaskScope } from "@/db/schema";
import { localTime, today } from "@/lib/dates";
import type { ShellNotification } from "@/lib/notifications";
import { agentTasks } from "./agents";
import { eventsBetween } from "./calendar";
import { liveOps } from "./ops-live";
import { listTasks } from "./tasks";

/** Local persisted sources only: notification refresh never waits for a provider. */
export async function loadNotifications(scope: TaskScope = "pessoal"): Promise<ShellNotification[]> {
  const now = new Date();
  const [overdue, upcoming, asks, ops] = await Promise.all([
    listTasks({ view: "atrasadas", limit: 30, scope }),
    scope === "pessoal" ? eventsBetween(now, new Date(now.getTime() + 3 * 3_600_000)) : Promise.resolve([]),
    scope === "empresa" ? agentTasks() : Promise.resolve([]),
    scope === "empresa" ? liveOps() : Promise.resolve({ events: [], monitors: [] }),
  ]);
  const t = today();
  const agentIds = new Set(asks.filter((a) => a.status !== "done").map((a) => a.id));
  return [
    ...ops.events.filter((e) => !e.resolvedAt && e.severity !== "info" && now.getTime() - e.createdAt.getTime() < 7 * 86_400_000).slice(0, 15)
      .map((e) => ({ id: `o-${e.id}`, title: e.subject, detail: e.kind === "workflow_error" ? "Falha de automação" : "Incidente operacional", href: "/operacao", tone: e.severity === "critical" ? "danger" as const : "warning" as const })),
    ...ops.monitors.filter((m) => m.silent).map((m) => ({ id: `m-${m.source}-${m.lastSeen.getTime()}`, title: m.label, detail: `Monitor sem sinal há ${m.minutesAgo} min`, href: "/operacao", tone: "warning" as const })),
    ...asks.filter((a) => a.status !== "done").slice(0, 20).map((a) => ({ id: `a-${a.id}`, title: a.title, detail: "Pedido de agente aguardando você", href: `/tarefas?escopo=empresa&task=${a.id}`, tone: "info" as const })),
    ...upcoming.filter((e) => !e.allDay).map((e) => ({ id: `e-${e.id}-${e.startAt.getTime()}`, title: e.title, detail: e.startAt <= now ? "Em andamento" : `Começa às ${localTime(e.startAt)}`, href: "/agenda", tone: "info" as const })),
    ...overdue.filter((tk) => !agentIds.has(tk.id)).map((tk) => ({ id: `t-${tk.id}-${tk.dueDate}`, title: tk.title, detail: `Atrasada · ${tk.dueDate === t ? "hoje" : tk.dueDate?.split("-").reverse().join("/")}`, href: `/tarefas?${tk.scope === "empresa" ? "escopo=empresa&" : ""}task=${tk.id}`, tone: "danger" as const })),
  ].slice(0, 80);
}
