import { describe, expect, it } from "vitest";
import { formatReviewDuration, reviewAverage, reviewDelta, reviewWindow, type ReviewPoint } from "@/components/life/review-model";

const points: ReviewPoint[] = Array.from({ length: 60 }, (_, index) => ({ date: `2026-${String(Math.floor(index / 30) + 9).padStart(2, "0")}-${String(index % 30 + 1).padStart(2, "0")}`, label: String(index), tasks: index >= 30 ? 2 : 1, focus: 25, habits: index % 2 ? null : 50, mood: index % 3 ? null : 4, energy: null, spend: 10 }));

describe("review periods", () => {
  it("compares equal 7, 14 and 30 day windows without changing the source", () => {
    for (const days of [7, 14, 30] as const) {
      const window = reviewWindow(points, days);
      expect(window.current).toHaveLength(days);
      expect(window.previous).toHaveLength(days);
      expect(window.totals.tasks).toBe(days * 2);
      expect(window.totals.focus).toBe(days * 25);
      expect(window.comparable).toBe(true);
      expect(window.current[0].date > window.previous.at(-1)!.date).toBe(true);
    }
    expect(points).toHaveLength(60);
  });
  it("preserves missing observations and includes real zero habit completion", () => {
    expect(reviewAverage([null, null])).toBeNull();
    expect(reviewAverage([null, 0, 100])).toBe(50);
    const window = reviewWindow(points.map((point) => ({ ...point, habits: null, mood: null, energy: null })), 7);
    expect(window.totals.habits).toBeNull();
    expect(window.totals.mood).toBeNull();
    expect(window.totals.habitDays).toBe(0);
    expect(window.totals.checkinDays).toBe(0);
    expect(window.current.every((point) => point.mood === null)).toBe(true);
  });
  it("does not advertise comparisons without a full previous period or a baseline", () => {
    expect(reviewWindow(points.slice(-7), 7).comparable).toBe(false);
    expect(reviewDelta(5, 0)).toBeNull();
    expect(reviewDelta(null, 3)).toBeNull();
    expect(reviewDelta(15, 10)).toBe(50);
    expect(reviewDelta(0, 10)).toBe(-100);
  });
  it("formats focus in explicit hours and minutes", () => {
    expect(formatReviewDuration(0)).toBe("0min");
    expect(formatReviewDuration(25)).toBe("25min");
    expect(formatReviewDuration(120)).toBe("2h");
    expect(formatReviewDuration(125)).toBe("2h 05min");
  });
});
