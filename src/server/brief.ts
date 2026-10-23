import "server-only";
import { formatLong, localTime, shiftDate, today, zonedToUtc } from "@/lib/dates";
import { agentTasks } from "./agents";
import { eventsBetween } from "./calendar";
import { CRM_ASSIGNEE, crmOverview } from "./crm";
import { listHabits } from "./habits";
import { liveOps } from "./ops-live";
import { getSettings } from "./settings";
import { listTasks, type TaskRow } from "./tasks";
import { escHtml } from "./telegram";

/** “Bom dia” da Órbita: agenda, tarefas pessoais e da empresa, CRM, pedidos de agentes e operação. Texto em HTML do Telegram. */
export async function buildBrief(): Promise<string> {
  const t = today();
  const [settings, events, pessoal, empresa, asks, habits, live, crm] = await Promise.all([
    getSettings(),
    eventsBetween(zonedToUtc(t), zonedToUtc(shiftDate(t, 1))),
    listTasks({ view: "hoje", scope: "pessoal", limit: 30 }),
    listTasks({ view: "hoje", scope: "empresa", limit: 30 }),
    agentTasks(),
    listHabits({ days: 30 }),
    liveOps(),
    crmOverview(0),
  ]);
  const base = process.env.APP_URL ?? "https://orb.aglabs.api.br";
  const first = settings.name.split(" ")[0];
  const lines: string[] = [`☀️ <b>Bom dia, ${escHtml(first)}</b> — ${escHtml(formatLong(t))}`, ""];

  lines.push("📅 <b>Agenda</b>");
  if (!events.length) lines.push("Dia livre.");
  for (const e of events.slice(0, 8)) lines.push(`• ${e.allDay ? "dia todo" : localTime(e.startAt)} ${escHtml(e.title)}`);

  const fmt = (x: TaskRow) => `• ${x.dueDate && x.dueDate < t ? "⚠️ " : ""}${escHtml(x.title)}${x.dueTime ? ` (${x.dueTime})` : ""}`;
  const block = (title: string, list: TaskRow[]) => {
    lines.push("", `${title} — ${list.length ? `${list.length} para hoje${list.some((x) => x.dueDate && x.dueDate < t) ? `, ${list.filter((x) => x.dueDate && x.dueDate < t).length} atrasada(s)` : ""}` : "nada para hoje"}`);
    for (const x of list.slice(0, 6)) lines.push(fmt(x));
    if (list.length > 6) lines.push(`… e mais ${list.length - 6}`);
  };
  block("✅ <b>Pessoal</b>", pessoal);
  block("🏢 <b>Empresa</b>", empresa);

  const open = asks.filter((a) => a.status !== "done");
  if (open.length) {
    lines.push("", `🤖 <b>Pedidos dos agentes</b> — ${open.length}`);
    for (const a of open.slice(0, 5)) lines.push(`• ${escHtml(a.title)} <i>(${escHtml(a.tags.find((x) => x.startsWith("agente:"))?.slice(7) ?? "agente")})</i>`);
  }

  if (crm.configured && !crm.ok) lines.push("", `💼 <b>CRM</b> — não consegui ler (${escHtml(crm.error)})`);
  if (crm.configured && crm.ok) {
    const s = crm.summary;
    const mine = crm.mine.filter((x) => x.prazo && x.prazo <= t);
    lines.push("", `💼 <b>CRM</b> — ${s.oportunidades_abertas} oportunidade(s) abertas · ${s.novos_7d} novo(s) em 7 dias · receita do mês ${s.receita_mes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);
    for (const x of mine.slice(0, 5)) lines.push(`• ${x.vencida ? "⚠️ " : ""}${escHtml(x.titulo)}${x.contato?.nome ? ` <i>(${escHtml(x.contato.nome)})</i>` : ""}`);
    const team = crm.team.filter((x) => x.vencida);
    if (team.length) lines.push(`• Time com ${team.length} tarefa(s) vencida(s): ${[...new Set(team.map((x) => CRM_ASSIGNEE[x.responsavel ?? "sem_responsavel"]))].join(", ")}`);
  }

  const todayHabits = habits.filter((h) => h.scheduledToday);
  if (todayHabits.length) lines.push("", `🔁 <b>Hábitos de hoje</b>: ${todayHabits.map((h) => escHtml(h.name)).join(", ")}`);

  const down = live.status.filter((s) => !s.ok);
  const soon = live.domains.filter((d) => d.expiresAt && d.expiresAt.getTime() - Date.now() < 45 * 86_400_000);
  const silent = live.monitors.filter((m) => m.silent);
  const wf = live.events.filter((e) => e.kind === "workflow_error" && Date.now() - e.createdAt.getTime() < 86_400_000);
  lines.push("", `🛰️ <b>Operação</b> — ${live.status.length ? `${live.status.length - down.length}/${live.status.length} no ar` : "sem dados dos monitores"}`);
  for (const d of down) lines.push(`• ❌ ${escHtml(d.name)}`);
  if (wf.length) lines.push(`• ${wf.length} falha(s) de workflow nas últimas 24h`);
  for (const d of soon) lines.push(`• 🌐 ${escHtml(d.domain)} vence em ${Math.ceil((d.expiresAt!.getTime() - Date.now()) / 86_400_000)} dias`);
  for (const m of silent) lines.push(`• ⚠️ monitor em silêncio: ${escHtml(m.label)}`);

  lines.push("", `<a href="${base}">Abrir a Órbita</a>`);
  return lines.join("\n");
}
