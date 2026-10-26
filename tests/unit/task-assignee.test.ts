import { describe, expect, it } from "vitest";
import { assigneeLabel, elapsed, isStale, normalizeAssignee } from "@/lib/task-assignee";

const now = Date.parse("2026-10-26T12:00:00Z");
const hoursAgo = (h: number) => new Date(now - h * 3_600_000);

describe("responsável da tarefa", () => {
  it("descreve livre, assumida, em andamento e concluída", () => {
    expect(assigneeLabel({ status: "todo", assignee: null, claimedAt: null }, now)).toBeNull();
    expect(assigneeLabel({ status: "todo", assignee: "Tom", claimedAt: hoursAgo(1) }, now)).toBe("Assumida por Tom");
    expect(assigneeLabel({ status: "doing", assignee: "Claude Code", claimedAt: hoursAgo(3) }, now)).toBe("Claude Code · em andamento há 3 h");
    expect(assigneeLabel({ status: "doing", assignee: "Tom", claimedAt: new Date(now - 10_000) }, now)).toBe("Tom · em andamento agora");
    expect(assigneeLabel({ status: "done", assignee: "Tom", claimedAt: hoursAgo(3) }, now)).toBe("Concluída por Tom");
  });

  it("formata o tempo decorrido em unidades legíveis", () => {
    expect(elapsed(new Date(now - 20_000), now)).toBe("agora");
    expect(elapsed(new Date(now - 12 * 60_000), now)).toBe("12 min");
    expect(elapsed(hoursAgo(47), now)).toBe("47 h");
    expect(elapsed(hoursAgo(72), now)).toBe("3 d");
    expect(elapsed(new Date(now + 60_000), now)).toBe("agora");
  });

  it("destaca só reservas em andamento há mais de 48 h", () => {
    expect(isStale({ status: "doing", assignee: "Tom", claimedAt: hoursAgo(49) }, now)).toBe(true);
    expect(isStale({ status: "doing", assignee: "Tom", claimedAt: hoursAgo(47) }, now)).toBe(false);
    expect(isStale({ status: "todo", assignee: "Tom", claimedAt: hoursAgo(100) }, now)).toBe(false);
    expect(isStale({ status: "doing", assignee: "Tom", claimedAt: null }, now)).toBe(false);
  });

  it("normaliza o nome e trata vazio como sem responsável", () => {
    expect(normalizeAssignee("  Claude   Code ")).toBe("Claude Code");
    expect(normalizeAssignee("   ")).toBeNull();
    expect(normalizeAssignee(null)).toBeNull();
  });
});
