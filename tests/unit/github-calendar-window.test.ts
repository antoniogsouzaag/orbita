import { describe, expect, it } from "vitest";
import { githubCalendarWindow } from "@/lib/github-calendar-window";

const days = Array.from({ length: 365 }, (_, i) => ({ date: new Date(Date.UTC(2025, 9, 26 + i)).toISOString().slice(0, 10), count: i % 5 }));

describe("calendário GitHub sem rolagem horizontal", () => {
  it.each([180, 248, 288, 342, 640, 900])("keeps daily squares at 11px and fits the last weeks in %ipx", width => {
    const window = githubCalendarWindow(days, width);
    expect(window.weeks.length * 14 - 3).toBeLessThanOrEqual(width);
    expect(window.days.at(-1)).toEqual(days.at(-1));
    expect(window.days.map(day => day.date)).toEqual(days.slice(-window.days.length).map(day => day.date));
  });

  it("shows more weeks as space grows without changing counts or the last date", () => {
    const mobile = githubCalendarWindow(days, 248);
    const desktop = githubCalendarWindow(days, 900);
    expect(mobile.days.length).toBeLessThan(desktop.days.length);
    expect(desktop.days).toEqual(days);
    expect(mobile.days.reduce((sum, day) => sum + day.count, 0)).toBe(days.slice(-mobile.days.length).reduce((sum, day) => sum + day.count, 0));
  });

  it("keeps Sunday alignment and handles empty and short histories", () => {
    expect(githubCalendarWindow([], 300).weeks).toEqual([]);
    const short = [{ date: "2026-10-21", count: 4 }];
    expect(githubCalendarWindow(short, 300).weeks[0]).toEqual([null, null, null, short[0]]);
    expect(githubCalendarWindow(days, null).weeks).toHaveLength(12);
  });
});
