import { describe, expect, it } from "vitest";
import { rankPriorities } from "@/lib/priorities";
import { focusedMinutes } from "@/lib/focus";

describe("próxima ação e registro de foco", () => {
  it("prioriza vencidas e de hoje antes de futuras, preservando a lista original", () => {
    const input = [
      { id: "futura", title: "Futura", priority: 3, dueDate: "2026-10-30" },
      { id: "hoje", title: "Hoje", priority: 1, dueDate: "2026-10-23" },
      { id: "vencida", title: "Vencida", priority: 0, dueDate: "2026-10-22" },
    ];
    expect(rankPriorities(input, "2026-10-23").map((task) => task.id)).toEqual(["vencida", "hoje", "futura"]);
    expect(input[0].id).toBe("futura");
  });
  it("pular não registra um bloco completo e pausa não conta como foco", () => {
    expect(focusedMinutes(25, 25 * 60, false)).toBe(0);
    expect(focusedMinutes(25, 22 * 60 + 10, false)).toBe(2);
    expect(focusedMinutes(25, 0, true)).toBe(25);
    expect(focusedMinutes(25, -60, false)).toBe(25);
  });
});
