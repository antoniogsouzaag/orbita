import Link from "next/link";
import { CalendarDays, CheckCheck, Radar } from "lucide-react";
import { ANSWERED_TAG } from "@/lib/proposals";
import { localTime, shiftDate, today, zonedToUtc } from "@/lib/dates";
import { availabilitySnapshot } from "@/lib/ops-freshness";
import { eventsBetween } from "@/server/calendar";
import { listTasks } from "@/server/tasks";
import { liveOps } from "@/server/ops-live";

export async function JournalDailyContext() {
  const date = today();
  const [events, personal, business, live] = await Promise.all([
    eventsBetween(zonedToUtc(date), zonedToUtc(shiftDate(date, 1))),
    listTasks({ scope: "pessoal", view: "hoje", limit: 30 }),
    listTasks({ scope: "empresa", view: "hoje", limit: 30 }), liveOps(),
  ]);
  const snapshot = availabilitySnapshot(live.status, live.monitors, live.generatedAt);
  const alerts = live.events.filter(event => !event.resolvedAt && event.severity !== "info");
  const due = business.filter(task => !task.tags.includes(ANSWERED_TAG));
  const attention = snapshot.down.length + snapshot.stale.length + live.monitors.filter(monitor => monitor.silent).length + alerts.filter(event => event.kind !== "site_down").length;
  return <section aria-label="Sua pauta de hoje" className="grid gap-3 md:grid-cols-3">
    <div className="rounded-2xl border border-border bg-surface/70 p-5">
      <p className="flex items-center gap-2 text-xs font-medium text-muted"><CalendarDays className="size-4" />Na sua agenda</p>
      <p className="my-3 text-2xl font-semibold tracking-tight">{events.length} <span className="text-sm font-normal text-muted">compromisso{events.length === 1 ? "" : "s"}</span></p>
      <ul className="space-y-2 text-xs text-muted">{events.slice(0, 2).map(event => <li key={event.id}><span className="mr-2 text-fg">{event.allDay ? "Dia todo" : localTime(event.startAt)}</span>{event.title}</li>)}</ul>
      <Link href="/agenda" className="mt-4 inline-block text-xs text-accent">Ver agenda →</Link>
    </div>
    <div className="rounded-2xl border border-border bg-surface/70 p-5">
      <p className="flex items-center gap-2 text-xs font-medium text-muted"><CheckCheck className="size-4" />O que pede sua atenção</p>
      <p className="my-3 text-2xl font-semibold tracking-tight">{personal.length + due.length}{personal.length === 30 || business.length === 30 ? "+" : ""} <span className="text-sm font-normal text-muted">tarefas devidas</span></p>
      <p className="text-xs text-muted">{personal.length} pessoais · {due.length} da empresa{personal.length === 30 || business.length === 30 ? " · consulta limitada" : ""}</p>
      <div className="mt-4 flex gap-4 text-xs text-accent"><Link href="/tarefas?view=hoje">Pessoal →</Link><Link href="/tarefas?escopo=empresa&view=hoje">Empresa →</Link></div>
    </div>
    <div className="rounded-2xl border border-border bg-surface/70 p-5">
      <p className="flex items-center gap-2 text-xs font-medium text-muted"><Radar className="size-4" />Pulso da operação</p>
      <p className={`my-3 text-2xl font-semibold tracking-tight ${attention ? "text-warning" : ""}`}>{!live.status.length ? "Sem cobertura" : attention ? `${attention} sinais` : "Em dia"}</p>
      <p className="text-xs leading-relaxed text-muted">{snapshot.up.length}/{live.status.length} endereços com verificação recente e no ar. Alertas refletem a amostra operacional.</p>
      <Link href="/operacao" className="mt-4 inline-block text-xs text-accent">Abrir operação →</Link>
    </div>
  </section>;
}
