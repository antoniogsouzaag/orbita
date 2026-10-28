import "server-only";
import { ANSWERED_TAG } from "@/lib/proposals";
import { formatLong, localTime, shiftDate, today, zonedToUtc } from "@/lib/dates";
import { agentTasks } from "./agents";
import { eventsBetween } from "./calendar";
import { CRM_ASSIGNEE, crmOverview } from "./crm";
import { liveOps } from "./ops-live";
import { availabilitySnapshot } from "@/lib/ops-freshness";
import { getSettings } from "./settings";
import { listTasks, type TaskRow } from "./tasks";
import { escHtml } from "./telegram";
import { agentReports } from "./agent-reports";

/** “Bom dia” da Órbita: agenda, tarefas pessoais e da empresa, CRM, pedidos de agentes e operação. Texto em HTML do Telegram. */
export async function buildBrief(): Promise<string> {
  const t = today();
  const [settings, events, pessoal, empresa, asks, live, crm, reports] = await Promise.all([
    getSettings(),
    eventsBetween(zonedToUtc(t), zonedToUtc(shiftDate(t, 1))),
    listTasks({ view: "hoje", scope: "pessoal", limit: 30 }),
    listTasks({ view: "hoje", scope: "empresa", limit: 30 }),
    agentTasks(),
    liveOps(),
    crmOverview(0),
    agentReports(),
  ]);
  const base = process.env.APP_URL ?? "https://orb.aglabs.api.br";
  const first = settings.name.split(" ")[0];
  const lines: string[] = [`☀️ <b>Bom dia, ${escHtml(first)}</b> — ${escHtml(formatLong(t))}`, ""];

  const short = (text: string) => escHtml(text.length > 120 ? `${text.slice(0, 117)}…` : text);
  if (events.length) lines.push("📅 <b>Agenda</b>");
  for (const e of events.slice(0, 3)) lines.push(`• ${e.allDay ? "dia todo" : localTime(e.startAt)} ${short(e.title)}`);

  const fmt = (x: TaskRow) => `• ${x.dueDate && x.dueDate < t ? "⚠️ " : ""}${short(x.title)}${x.dueTime ? ` (${x.dueTime})` : ""}`;
  const block = (title: string, list: TaskRow[]) => {
    if (!list.length) return;
    lines.push("", `${title} — ${list.length ? `${list.length} para hoje${list.some((x) => x.dueDate && x.dueDate < t) ? `, ${list.filter((x) => x.dueDate && x.dueDate < t).length} atrasada(s)` : ""}` : "nada para hoje"}`);
    for (const x of list.slice(0, 3)) lines.push(fmt(x));
    if (list.length > 3) lines.push(`… e mais ${list.length - 3} na Órbita`);
  };
  block("✅ <b>Pessoal</b>", pessoal);
  block("🏢 <b>Empresa</b>", empresa.filter(task => !task.tags?.includes(ANSWERED_TAG)));

  const open = asks.filter((a) => a.status !== "done" && !a.tags?.includes(ANSWERED_TAG));
  if (open.length) {
    lines.push("", `🤖 <b>Pedidos dos agentes</b> — ${open.length}`);
    for (const a of open.slice(0, 2)) lines.push(`• ${short(a.title)} <i>(${escHtml(a.tags.find((x) => x.startsWith("agente:"))?.slice(7) ?? "agente")})</i>`);
  }

  if (crm.configured && !crm.ok) lines.push("", `💼 <b>CRM</b> — não consegui ler (${escHtml(crm.error)})`);
  if (crm.configured && crm.ok) {
    const mine = crm.mine.filter((x) => x.prazo && x.prazo <= t);
    const team = crm.team.filter((x) => x.vencida);
    if (mine.length || team.length) lines.push("", "💼 <b>CRM · ações devidas</b>");
    for (const x of mine.slice(0, 3)) lines.push(`• ${x.vencida ? "⚠️ " : ""}${short(x.titulo)}`);
    if (team.length) lines.push(`• Time com ${team.length} tarefa(s) vencida(s): ${[...new Set(team.map((x) => CRM_ASSIGNEE[x.responsavel ?? "sem_responsavel"]))].join(", ")}`);
  }

  // Rotinas e totais comerciais continuam nos painéis; o aviso traz só ações devidas.

  const snapshot = availabilitySnapshot(live.status, live.monitors, live.generatedAt);
  const down = snapshot.down;
  const soon = live.domains.filter((d) => d.expiresAt && d.expiresAt.getTime() - Date.now() < 45 * 86_400_000);
  const silent = live.monitors.filter((m) => m.silent);
  const pendingWorkflows = live.events.filter(e => e.kind === "workflow_error" && !e.resolvedAt);
  const noCoverage = !live.status.length;
  if (down.length || soon.length || silent.length || pendingWorkflows.length || noCoverage || snapshot.stale.length) lines.push("", "🛰️ <b>Operação · atenção</b>");
  if (noCoverage) lines.push("• Sem dados dos monitores nesta consulta.");
  if (snapshot.stale.length) lines.push(`• ${snapshot.stale.length} endereço(s) sem verificação recente.`);
  for (const d of down.slice(0, 3)) lines.push(`• ❌ ${short(d.name)}`);
  if (pendingWorkflows.length) lines.push(`• ${pendingWorkflows.length} falha(s) de workflow sem resolução registrada (inclui antigas)`);
  for (const d of soon.slice(0, 3)) lines.push(`• 🌐 ${short(d.domain)} vence em ${Math.ceil((d.expiresAt!.getTime() - Date.now()) / 86_400_000)} dias`);
  for (const m of silent.slice(0, 3)) lines.push(`• ⚠️ monitor em silêncio: ${short(m.label)}`);

  if (reports.length) {
    lines.push("", "📨 <b>Resumos dos agentes · últimas 24h</b>");
    for (const report of reports.slice(0, 2)) lines.push(`• ${short(report.source.replace(/^agente:/, ""))} · ${localTime(report.createdAt)}: ${short(report.subject)}`);
  }
  if (lines.length === 2) return "";
  lines.push("", `<a href="${base}">Abrir a Órbita</a>`);
  return lines.join("\n");
}
