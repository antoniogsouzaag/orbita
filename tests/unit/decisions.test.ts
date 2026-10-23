import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/server/tasks", () => ({ listTasks: vi.fn(async () => [{ id: "t1", title: "Tarefa pessoal", dueDate: null, priority: 2 }, { id: "t2", title: "Outra tarefa", dueDate: null, priority: 1 }]) }));
import { suggestNextAction } from "@/server/decisions";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Jev opcional e limitado a sugestões", () => {
  it("funciona sem API e não chama outro modelo", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const request = vi.fn(); vi.stubGlobal("fetch", request);
    expect(await suggestNextAction()).toMatchObject({ source: "rules", taskId: "t1" });
    expect(request).not.toHaveBeenCalled();
  });
  it("recusa escolha inventada ou confiança baixa e aceita apenas id existente", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "private-key");
    for (const [choice, confidence, expected] of [["inventada", 1, "rules"], ["t2", 0.2, "rules"], ["t2", 0.9, "jev"]] as const) {
      vi.stubGlobal("fetch", vi.fn(async () => Response.json({ answers: { proxima: { choice, confidence, probabilities: { [choice]: 0.95 } } } })));
      const result = await suggestNextAction();
      expect(result.source).toBe(expected);
      expect(JSON.stringify(result)).not.toContain("private-key");
    }
  });
});
