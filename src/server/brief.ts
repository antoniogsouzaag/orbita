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
import { compactBrief, journalHref } from "@/lib/journal";
import { journalFeed } from "./journal";

/** “Bom dia” da Órbita: agenda, tarefas pessoais e da empresa, CRM, pedidos de agentes e operação. Texto em HTML do Telegram. */
export async function buildBrief(): Promise<string> {
  const t = today();
  const [settings, events, pessoal, empresa, asks, live, crm, reports, journal] = await Promise.all([
    getSettings(),
    eventsBetween(zonedToUtc(t), zonedToUtc(shiftDate(t, 1))),
    listTasks({ view: "hoje", scope: "pessoal", limit: 30 }),
    listTasks({ view: "hoje", scope: "empresa", limit: 30 }),
    agentTasks(),
    liveOps(),
    crmOverview(0),
    agentReports(),
    journalFeed(t).catch(() => null),
  ]);
  let base = "https://orb.aglabs.api.br";
  try {
    const configured = new URL(process.env.APP_URL ?? base);
    if (["https:", "http:"].includes(configured.protocol) && configured.origin.length < 300) base = configured.origin;
  } catch { /* A malformed configuration must not break the scheduled summary. */ }
  const first = settings.name.split(" ")[0];
  const lines: string[] = [`☀️ <b>Bom dia, ${escHtml(first)}</b> — ${escHtml(formatLong(t))}`, ""];

  const short = (text: string) => escHtml(text.length > 120 ? `${text.slice(0, 117)}…` : text);
  // Operational exceptions precede routine content; the fixed budget cannot bury them.
  const snapshot = availabilitySnapshot(live.status, live.monitors, live.generatedAt);
  const down = snapshot.down;
  const soon = live.domains.filter((d) => d.expiresAt && d.expiresAt.getTime() - Date.now() < 45 * 86_400_000);
  const silent = live.monitors.filter((m) => m.silent);
  const pendingWorkflows = live.events.filter(e => e.kind === "workflow_error" && !e.resolvedAt);
  const noCoverage = !live.status.length;
  if (down.length || soon.length || silent.length || pendingWorkflows.length || noCoverage || snapshot.stale.length) lines.push("🛰️ <b>Operação · atenção</b>");
  if (noCoverage) lines.push("• Sem dados dos monitores nesta consulta.");
  if (snapshot.stale.length) lines.push(`• ${snapshot.stale.length} endereço(s) sem verificação recente.`);
  for (const d of down.slice(0, 2)) lines.push(`• ❌ ${short(d.name)}`);
  if (pendingWorkflows.length) lines.push(`• ${pendingWorkflows.length} falha(s) de workflow sem resolução registrada (inclui antigas)`);
  if (soon.length) lines.push(`• 🌐 ${soon.length} domínio(s) vencem em até 45 dias`);
  if (silent.length) lines.push(`• ⚠️ ${silent.length} monitor(es) em silêncio`);

  if (events.length) lines.push("📅 <b>Agenda</b>");
  for (const e of events.slice(0, 2)) lines.push(`• ${e.allDay ? "dia todo" : localTime(e.startAt)} ${short(e.title)}`);

  const fmt = (x: TaskRow) => `• ${x.dueDate && x.dueDate < t ? "⚠️ " : ""}${short(x.title)}${x.dueTime ? ` (${x.dueTime})` : ""}`;
  const block = (title: string, list: TaskRow[]) => {
    if (!list.length) return;
    lines.push("", `${title} — ${list.length ? `${list.length} para hoje${list.some((x) => x.dueDate && x.dueDate < t) ? `, ${list.filter((x) => x.dueDate && x.dueDate < t).length} atrasada(s)` : ""}` : "nada para hoje"}`);
    for (const x of list.slice(0, 2)) lines.push(fmt(x));
    if (list.length > 2) lines.push(`… e mais ${list.length - 2} no Jornal`);
  };
  block("✅ <b>Pessoal</b>", pessoal);
  block("🏢 <b>Empresa</b>", empresa.filter(task => !task.tags?.includes(ANSWERED_TAG)));

  const open = asks.filter((a) => a.status !== "done" && !a.tags?.includes(ANSWERED_TAG));
  if (open.length) {
    lines.push("", `🤖 <b>Pedidos dos agentes</b> — ${open.length}`);
    for (const a of open.slice(0, 2)) lines.push(`• ${short(a.title)} <i>(${escHtml(a.tags.find((x) => x.startsWith("agente:"))?.slice(7) ?? "agente")})</i>`);
  }

  if (crm.configured && !crm.ok) lines.push("", "💼 <b>CRM</b> — indisponível nesta consulta.");
  if (crm.configured && crm.ok) {
    const mine = crm.mine.filter((x) => x.prazo && x.prazo <= t);
    const team = crm.team.filter((x) => x.vencida);
    if (mine.length || team.length) lines.push("", "💼 <b>CRM · ações devidas</b>");
    for (const x of mine.slice(0, 1)) lines.push(`• ${x.vencida ? "⚠️ " : ""}${short(x.titulo)}`);
    if (team.length) lines.push(`• Time com ${team.length} tarefa(s) vencida(s): ${[...new Set(team.map((x) => CRM_ASSIGNEE[x.responsavel ?? "sem_responsavel"]))].join(", ")}`);
  }

  // Rotinas e totais comerciais continuam nos painéis; o aviso traz só ações devidas.

  const headline = journal?.articles.find(article => article.destaque) ?? journal?.articles[0];
  if (headline) lines.push("", `🗞️ <b>No Jornal</b> — ${short(headline.titulo)}`);
  else if (reports.length) lines.push("", `📨 <b>No Jornal</b> — ${reports.length} resumo(s) de agentes nas últimas 24h`);
  if (lines.length === 2) lines.push("Sua edição está disponível. Sem pendências devidas nas fontes consultadas.");
  const link = escHtml(new URL(journalHref(t), base).toString()).replace(/"/g, "&quot;");
  return compactBrief(lines, `<a href="${link}">Ler o Jornal da Órbita →</a>`);
}
