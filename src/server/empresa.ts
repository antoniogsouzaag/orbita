import "server-only";
import { agentTasks, recentActivity } from "@/server/agents";
import { aiEnabled } from "@/server/ai";
import { eventsBetween } from "@/server/calendar";
import { crmOverview, crmUrl, type CrmTask } from "@/server/crm";
import { githubInbox } from "@/server/github-inbox";
import { listGoals } from "@/server/goals";
import { groupAgenda } from "@/server/home";
import { liveOps } from "@/server/ops-live";
import { listProjects } from "@/server/projects";
import { getSettings } from "@/server/settings";
import { homeTasks, listTasks, taskCounts } from "@/server/tasks";
import { greeting } from "@/lib/greeting";
import { localHour, shiftDate, today, zonedToUtc } from "@/lib/dates";

const DAY = 86_400_000;

/** Início da Empresa: o que espera Antonio, a operação, o CRM e o trabalho dos agentes. */
export async function loadEmpresaLocal() {
  const t = today();
  const now = new Date();
  const [settings, live, asksAll, activity, tasks, counts, due, projects, goals, events] = await Promise.all([
    getSettings(),
    liveOps(),
    agentTasks(),
    recentActivity(8),
    homeTasks(7, "empresa"),
    taskCounts("empresa"),
    listTasks({ view: "hoje", scope: "empresa", limit: 20 }),
    listProjects(),
    listGoals("ativa"),
    eventsBetween(zonedToUtc(t), zonedToUtc(shiftDate(t, 8))),
  ]);

  const asks = asksAll.filter((x) => x.status !== "done");
  const down = live.status.filter((s) => !s.ok);
  const failures = live.events.filter((e) => e.kind === "workflow_error" && now.getTime() - e.createdAt.getTime() < DAY);
  const incidents = live.events.filter((e) => ["site_down", "workflow_error", "domain_alert", "monitor_silent"].includes(e.kind) && now.getTime() - e.createdAt.getTime() < 7 * DAY);
  const domains = live.domains.filter((d) => d.expiresAt || d.error).map((d) => ({ ...d, days: d.expiresAt ? Math.ceil((d.expiresAt.getTime() - now.getTime()) / DAY) : null }));
  const soon = domains.filter((d) => d.expiresAt && d.expiresAt.getTime() - now.getTime() < 45 * DAY);
  const silent = live.monitors.filter((m) => m.silent);
  const crmMine: CrmTask[] = [];
  const overdue = due.filter((d) => d.dueDate && d.dueDate < t);
  const waiting = asks.length + due.length + crmMine.length;

  let subtitle: { text: string; tone?: "warning" };
  if (down.length) subtitle = { text: `⚠ Fora do ar: ${down.map((d) => d.name).join(", ")}`, tone: "warning" };
  else if (silent.length) subtitle = { text: `⚠ Monitor em silêncio: ${silent.map((m) => m.label).join(", ")}`, tone: "warning" };
  else if (waiting) subtitle = { text: `${waiting} ${waiting === 1 ? "item aguardando" : "itens aguardando"} você${overdue.length ? ` · ${overdue.length} ${overdue.length === 1 ? "atrasada" : "atrasadas"}` : ""}` };
  else if (live.status.length) subtitle = { text: `Tudo no ar · ${live.status.length} endereços monitorados` };
  else subtitle = { text: `${counts.open} tarefas abertas na empresa` };

  const empresaProjects = projects.filter((p) => p.area === "empresa");

  return {
    settings,
    title: greeting(settings.name, localHour(), t),
    subtitle,
    today: t,
    asks,
    due,
    crmMine,
    crmTasksUrl: crmUrl("/tasks"),
    tasks,
    counts,
    activity,
    ops: { total: live.status.length, down, failures, soon, monitors: live.monitors, silent },
    incidents,
    domains,
    projects: empresaProjects,
    goals: goals.filter((g) => g.area === "empresa"),
    agenda: groupAgenda(events, now, t),
    aiEnabled: aiEnabled(),
  };
}

/** Full snapshot for callers that need all sources; the UI streams providers independently. */
export async function loadEmpresa() {
  const [local, gh, crm] = await Promise.all([loadEmpresaLocal(), githubInbox(), crmOverview()]);
  return { ...local, gh, crm, crmMine: crm.configured && crm.ok ? crm.mine.filter((x) => x.prazo && x.prazo <= local.today) : [] };
}

export type EmpresaData = Awaited<ReturnType<typeof loadEmpresa>>;
