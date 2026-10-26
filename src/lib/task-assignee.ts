/** Responsável por uma tarefa: quem assumiu, há quanto tempo e se parece parada. Sem dependência de servidor. */

export const OWNER_NAME = "Antonio";
/** Em andamento sem troca de responsável há mais que isso merece conferência. */
export const STALE_HOURS = 48;

type Claimable = { status: string; assignee: string | null; claimedAt: Date | string | null };

const ms = (d: Date | string) => (typeof d === "string" ? new Date(d) : d).getTime();

/** "agora", "12 min", "5 h", "3 d". */
export function elapsed(from: Date | string, now = Date.now()) {
  const min = Math.max(0, Math.floor((now - ms(from)) / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

export function isStale(task: Claimable, now = Date.now()) {
  return task.status === "doing" && !!task.claimedAt && now - ms(task.claimedAt) > STALE_HOURS * 3_600_000;
}

/** Texto curto para cards e listas; null quando ninguém assumiu. */
export function assigneeLabel(task: Claimable, now = Date.now()): string | null {
  if (!task.assignee) return null;
  if (task.status === "done") return `Concluída por ${task.assignee}`;
  if (task.status === "doing") {
    const e = task.claimedAt ? elapsed(task.claimedAt, now) : null;
    return `${task.assignee} · em andamento${e ? (e === "agora" ? " agora" : ` há ${e}`) : ""}`;
  }
  return `Assumida por ${task.assignee}`;
}

/** Normaliza o nome digitado/selecionado; vazio vira null (sem responsável). */
export function normalizeAssignee(v: string | null | undefined) {
  const name = v?.trim().replace(/\s+/g, " ") ?? "";
  return name ? name.slice(0, 80) : null;
}
