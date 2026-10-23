export type ReviewPoint = { date: string; label: string; tasks: number; habits: number | null; focus: number; mood: number | null; energy: number | null; spend: number };
export const REVIEW_PERIODS = [7, 14, 30] as const;
export type ReviewPeriod = (typeof REVIEW_PERIODS)[number];

export function reviewAverage(values: (number | null)[]) {
  const recorded = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return recorded.length ? Math.round(recorded.reduce((sum, value) => sum + value, 0) / recorded.length * 10) / 10 : null;
}

export function reviewWindow(data: ReviewPoint[], days: ReviewPeriod) {
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const current = sorted.slice(-days);
  const previous = sorted.slice(-days * 2, -days);
  const summarize = (points: ReviewPoint[]) => ({
    tasks: points.reduce((sum, point) => sum + point.tasks, 0),
    focus: points.reduce((sum, point) => sum + point.focus, 0),
    spend: points.reduce((sum, point) => sum + point.spend, 0),
    habits: reviewAverage(points.map((point) => point.habits)),
    mood: reviewAverage(points.map((point) => point.mood)),
    energy: reviewAverage(points.map((point) => point.energy)),
    habitDays: points.filter((point) => point.habits !== null).length,
    checkinDays: points.filter((point) => point.mood !== null || point.energy !== null).length,
    activeDays: points.filter((point) => point.tasks > 0 || point.focus > 0).length,
  });
  return { current, previous, totals: summarize(current), before: summarize(previous), comparable: current.length === days && previous.length === days };
}

export function reviewDelta(now: number | null, previous: number | null) {
  if (now === null || previous === null || previous === 0) return null;
  return Math.round((now - previous) / previous * 100);
}

export function formatReviewDuration(minutes: number) {
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return hours ? `${hours}h${remainder ? ` ${String(remainder).padStart(2, "0")}min` : ""}` : `${remainder}min`;
}
