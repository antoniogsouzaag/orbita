import { describe, expect, it } from "vitest";
import { currentStreak, dayStreak, isScheduled, lastDays, nextMilestone, weekCount } from "@/lib/habits";

const daily = { frequency: "daily", timesPerWeek: 7, weekdays: [] as number[] };
const TODAY = "2026-10-22"; // quinta

describe("hábitos", () => {
  it("sequência diária não quebra com hoje pendente", () => {
    const done = new Set(["2026-10-19", "2026-10-20", "2026-10-21"]);
    expect(currentStreak(daily, done, TODAY)).toEqual({ value: 3, unit: "dias" });
    done.add(TODAY);
    expect(currentStreak(daily, done, TODAY).value).toBe(4);
  });
  it("sequência quebra com dia agendado perdido", () => {
    const done = new Set(["2026-10-18", "2026-10-21"]);
    expect(currentStreak(daily, done, TODAY).value).toBe(1);
  });
  it("dias não agendados são pulados", () => {
    const weekdays = { ...daily, weekdays: [1, 3, 5] }; // seg, qua, sex
    expect(isScheduled(weekdays, "2026-10-21")).toBe(true);
    expect(isScheduled(weekdays, TODAY)).toBe(false);
    const done = new Set(["2026-10-16", "2026-10-19", "2026-10-21"]);
    expect(currentStreak(weekdays, done, TODAY).value).toBe(3);
  });
  it("semanal conta semanas que bateram a meta", () => {
    const weekly = { frequency: "weekly", timesPerWeek: 3, weekdays: [] };
    // semana passada (12-18): 3x · semana retrasada (5-11): 3x · atual: 1x
    const done = new Set(["2026-10-12", "2026-10-14", "2026-10-16", "2026-10-05", "2026-10-07", "2026-10-09", "2026-10-20"]);
    expect(currentStreak(weekly, done, TODAY)).toEqual({ value: 2, unit: "sem" });
    expect(weekCount(done, TODAY)).toBe(1);
  });
  it("últimos 7 dias e marcos", () => {
    const cells = lastDays(daily, new Set([TODAY]), TODAY);
    expect(cells).toHaveLength(7);
    expect(cells.at(-1)).toEqual({ date: TODAY, done: true, scheduled: true });
    expect(nextMilestone(0)).toBe(3);
    expect(nextMilestone(3)).toBe(7);
    expect(dayStreak(new Set(["2026-10-21", "2026-10-20"]), TODAY)).toBe(2);
  });
});
