/** A leitura operacional combina até 80 eventos recentes com até 80 alertas abertos. */
export const OPS_EVENT_COVERAGE = "Amostra: até 80 eventos dos últimos 14 dias e até 80 eventos não resolvidos de severidade aviso ou crítica, incluindo antigos; não representa o histórico completo.";

type Event = { kind: string; severity: string; resolvedAt: Date | null; createdAt: Date; subject: string };
const DAY = 86_400_000;

export function opsEventLabel(kind: string) {
  return kind === "site_down" ? "Queda de site" : kind === "workflow_error" ? "Falha de automação" : "Alerta operacional";
}

/** Categorias mutuamente exclusivas de registros abertos, não de disponibilidade atual. */
export function classifyOpsEvents<T extends Event>(events: T[], now: number) {
  const open = events.filter((event) => !event.resolvedAt);
  return {
    siteIncidents: open.filter((event) => event.kind === "site_down"),
    pendingWorkflows: open.filter((event) => event.kind === "workflow_error"),
    recentWorkflows: events.filter((event) => event.kind === "workflow_error" && event.createdAt.getTime() <= now && now - event.createdAt.getTime() < DAY),
    otherAlerts: open.filter((event) => event.kind !== "site_down" && event.kind !== "workflow_error" && (event.severity === "warning" || event.severity === "critical")),
  };
}

export function opsEventSummary<T extends Event>(events: T[], now: number): string[] {
  const classified = classifyOpsEvents(events, now);
  const subjects = (items: T[]) => items.length ? ` — ${items.slice(0, 10).map((event) => event.subject.replace(/\s+/g, " ").slice(0, 160)).join("; ")}${items.length > 10 ? "; demais omitidos" : ""}` : "";
  return [
    OPS_EVENT_COVERAGE,
    `Quedas de sites não resolvidas na amostra: ${classified.siteIncidents.length}${subjects(classified.siteIncidents)}.`,
    `Falhas de workflow na amostra: ${classified.recentWorkflows.length} nas últimas 24h; ${classified.pendingWorkflows.length} sem resolução registrada (inclui antigas)${subjects(classified.pendingWorkflows)}.`,
    `Outros alertas ou relatos de agentes não resolvidos na amostra: ${classified.otherAlerts.length}${subjects(classified.otherAlerts)}.`,
  ];
}
