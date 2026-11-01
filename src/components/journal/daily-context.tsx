import Link from "next/link";
import { ANSWERED_TAG } from "@/lib/proposals";
import { localTime, shiftDate, today, zonedToUtc } from "@/lib/dates";
import { availabilitySnapshot } from "@/lib/ops-freshness";
import { opsEventLabel } from "@/lib/ops-events";
import { eventsBetween } from "@/server/calendar";
import { listTasks } from "@/server/tasks";
import { liveOps } from "@/server/ops-live";

export async function JournalDailyContext() {
  const date = today();
  const start = zonedToUtc(date).getTime();
  const end = zonedToUtc(shiftDate(date, 1)).getTime();
  const isToday = (at: Date) => at.getTime() >= start && at.getTime() < end;
  const [events, personal, business, live] = await Promise.all([
    eventsBetween(new Date(start), new Date(end)),
    listTasks({ scope: "pessoal", view: "hoje", limit: 30 }),
    listTasks({ scope: "empresa", view: "hoje", limit: 30 }), liveOps(),
  ]);
  const snapshot = availabilitySnapshot(live.status, live.monitors, live.generatedAt);
  const tasks = [...personal.map(task => ({ ...task, scope: "pessoal" })), ...business.map(task => ({ ...task, scope: "empresa" }))].filter(task => !task.tags.includes(ANSWERED_TAG));
  const alerts = live.events.filter(event => !event.resolvedAt && event.severity !== "info" && event.kind !== "site_down");
  // A recovery is one story, rather than a second copy of the original failure.
  const recovered = live.events.filter(event => event.kind === "site_up" && isToday(event.createdAt));
  const resolved = live.events.filter(event => event.kind !== "site_down" && event.severity !== "info" && event.resolvedAt && isToday(event.resolvedAt));
  const silent = live.monitors.filter(monitor => monitor.silent);
  if (!events.length && !tasks.length && !alerts.length && !recovered.length && !resolved.length && !snapshot.down.length && !snapshot.stale.length && !silent.length) return null;
  return <section aria-label="O que importa hoje" className="my-5 space-y-4 border-y border-border py-4">
    <h2 className="text-sm font-semibold">O que importa hoje</h2>
    {!!(alerts.length || snapshot.down.length || snapshot.stale.length || silent.length) && <div><h3 className="mb-2 text-xs font-medium text-warning">Precisa de atenção</h3><ul className="space-y-3 text-sm">
      {alerts.map(event => <li key={event.id}><Link className="text-accent hover:underline" href={`/operacao#evento-${event.id}`}>{event.subject} →</Link><p className="mt-1 text-xs text-muted">{event.kind.startsWith("agente_") ? "Alerta de agente" : opsEventLabel(event.kind)} · {event.source} · aberto em {event.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Sem resolução registrada.</p></li>)}
      {snapshot.down.map(site => <li key={site.url}><Link href="/operacao#disponibilidade" className="text-accent">{site.name}: endereço com falha →</Link></li>)}
      {snapshot.stale.map(site => <li key={site.url}><Link href="/operacao#disponibilidade" className="text-accent">{site.name}: verificação desatualizada →</Link></li>)}
      {silent.map(monitor => <li key={monitor.source}><Link href="/operacao/automacoes" className="text-accent">{monitor.label}: coleta sem atualização →</Link></li>)}
    </ul></div>}
    {!!(recovered.length || resolved.length) && <div><h3 className="mb-2 text-xs font-medium">Resolvido hoje</h3><ul className="space-y-2 text-sm">{recovered.map(event => <li key={event.id}><Link href={`/operacao#evento-${event.id}`} className="text-accent">{event.subject}: houve uma falha e o endereço voltou ao ar às {localTime(event.createdAt)} →</Link></li>)}{resolved.map(event => <li key={event.id}><Link href={`/operacao#evento-${event.id}`} className="text-accent">{event.subject}: resolução registrada às {localTime(event.resolvedAt!)} →</Link>{typeof event.detail.resolution === "string" && <p className="mt-1 text-xs text-muted">{event.detail.resolution}</p>}</li>)}</ul></div>}
    {!!tasks.length && <div><h3 className="mb-2 text-xs font-medium">Para você decidir ou fazer</h3><ul className="space-y-2 text-sm">{tasks.map(task => <li key={task.id}><Link className="text-accent hover:underline" href={`/tarefas?escopo=${task.scope}&view=hoje&task=${task.id}`}>{task.title} →</Link><span className="ml-2 text-xs text-muted">{task.scope === "empresa" ? "Empresa" : "Pessoal"}{task.dueDate && task.dueDate < date ? " · atrasada" : ""}{task.dueTime ? ` · ${task.dueTime}` : ""}</span></li>)}</ul>{(personal.length === 30 || business.length === 30) && <p className="mt-2 text-xs text-muted">Seleção limitada. <Link href="/tarefas" className="text-accent">Ver todas as tarefas →</Link></p>}</div>}
    {!!events.length && <div><h3 className="mb-2 text-xs font-medium">Compromissos de hoje</h3><ul className="space-y-2 text-sm">{events.map(event => <li key={event.id}><Link href="/agenda" className="text-accent">{event.allDay ? "Dia todo" : localTime(event.startAt)} · {event.title} →</Link></li>)}</ul></div>}
  </section>;
}
