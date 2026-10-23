import { lastNDays, shiftDate, startOfWeekISO, weekday } from "./dates";

export type HabitLike = {
  frequency: string;
  timesPerWeek: number;
  weekdays: number[];
  createdAt?: Date | string;
};

export function isScheduled(h: HabitLike, date: string): boolean {
  if (h.frequency === "weekly") return true;
  return h.weekdays.length === 0 || h.weekdays.includes(weekday(date));
}

export type DayCell = { date: string; done: boolean; scheduled: boolean };

export function lastDays(h: HabitLike, done: Set<string>, end: string, n = 7): DayCell[] {
  return lastNDays(n, end).map((date) => ({ date, done: done.has(date), scheduled: isScheduled(h, date) }));
}

/**
 * Sequência atual.
 * - diário: dias agendados seguidos com check (hoje ainda pendente não quebra).
 * - semanal: semanas seguidas batendo a meta (semana atual conta se já bateu).
 */
export function currentStreak(h: HabitLike, done: Set<string>, today: string): { value: number; unit: "dias" | "sem" } {
  if (h.frequency === "weekly") {
    const target = Math.max(1, h.timesPerWeek);
    let weekStart = startOfWeekISO(today);
    let streak = 0;
    const countWeek = (start: string) => lastNDays(7, shiftDate(start, 6)).filter((d) => done.has(d)).length;
    if (countWeek(weekStart) >= target) streak++;
    weekStart = shiftDate(weekStart, -7);
    for (let i = 0; i < 520; i++) {
      if (countWeek(weekStart) >= target) {
        streak++;
        weekStart = shiftDate(weekStart, -7);
      } else break;
    }
    return { value: streak, unit: "sem" };
  }

  let day = today;
  if (isScheduled(h, day) && !done.has(day)) day = shiftDate(day, -1);
  let streak = 0;
  for (let i = 0; i < 3650; i++) {
    if (!isScheduled(h, day)) {
      day = shiftDate(day, -1);
      continue;
    }
    if (done.has(day)) {
      streak++;
      day = shiftDate(day, -1);
    } else break;
  }
  return { value: streak, unit: "dias" };
}

/** Quantas vezes o hábito foi feito na semana corrente (seg–dom). */
export function weekCount(done: Set<string>, today: string): number {
  const start = startOfWeekISO(today);
  return lastNDays(7, shiftDate(start, 6)).filter((d) => d <= today && done.has(d)).length;
}

export const MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365, 500, 1000];

export function nextMilestone(streak: number): number {
  return MILESTONES.find((m) => m > streak) ?? streak + 100;
}

/** Dias seguidos (terminando hoje ou ontem) em que `active` tem a data. */
export function dayStreak(active: Set<string>, today: string): number {
  let day = active.has(today) ? today : shiftDate(today, -1);
  let n = 0;
  while (active.has(day)) {
    n++;
    day = shiftDate(day, -1);
  }
  return n;
}

/** Maior sequência já registrada (dias agendados seguidos com check). */
export function bestStreak(h: HabitLike, done: Set<string>, today: string): number {
  if (done.size === 0) return 0;
  if (h.frequency === "weekly") {
    let best = 0;
    let cur = 0;
    const sorted = [...done].sort();
    let week = startOfWeekISO(sorted[0]);
    const end = startOfWeekISO(today);
    while (week <= end) {
      const n = lastNDays(7, shiftDate(week, 6)).filter((d) => done.has(d)).length;
      cur = n >= Math.max(1, h.timesPerWeek) ? cur + 1 : 0;
      best = Math.max(best, cur);
      week = shiftDate(week, 7);
    }
    return best;
  }
  const sorted = [...done].sort();
  let best = 0;
  let cur = 0;
  let day = sorted[0];
  while (day <= today) {
    if (isScheduled(h, day)) {
      if (done.has(day)) {
        cur++;
        best = Math.max(best, cur);
      } else if (day !== today) cur = 0;
    }
    day = shiftDate(day, 1);
  }
  return best;
}

/** Taxa de conclusão nos últimos N dias (apenas dias agendados). */
export function completionRate(h: HabitLike, done: Set<string>, today: string, n = 30): number {
  if (h.frequency === "weekly") {
    const days = lastNDays(n, today);
    const count = days.filter((d) => done.has(d)).length;
    return Math.min(100, Math.round((count / ((n / 7) * Math.max(1, h.timesPerWeek))) * 100));
  }
  const days = lastNDays(n, today).filter((d) => isScheduled(h, d));
  if (!days.length) return 0;
  return Math.round((days.filter((d) => done.has(d)).length / days.length) * 100);
}
