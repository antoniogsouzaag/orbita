import type { ActivityDay } from "@/server/github";

/** Quadrados de 11px e espaço de 3px; mostra as semanas mais recentes. */
export function githubCalendarWindow(days: ActivityDay[], width: number | null) {
  if (!days.length) return { weeks: [] as (ActivityDay | null)[][], days: [] as ActivityDay[] };
  const padding = new Date(`${days[0].date}T12:00:00Z`).getUTCDay();
  const cells: (ActivityDay | null)[] = [...Array<null>(padding).fill(null), ...days];
  const allWeeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const capacity = width === null ? 12 : Math.max(1, Math.floor((Math.max(0, width) + 3) / 14));
  const weeks = allWeeks.slice(-capacity);
  return { weeks, days: weeks.flat().filter((day): day is ActivityDay => day !== null) };
}
