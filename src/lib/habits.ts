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
