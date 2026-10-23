import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/server/tasks", () => ({ listTasks: vi.fn(async () => [{ id: "t1", title: "Tarefa pessoal", dueDate: null, priority: 2 }, { id: "t2", title: "Outra tarefa", dueDate: null, priority: 1 }]) }));
import { suggestNextAction } from "@/server/decisions";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Jev opcional e limitado a sugestões", () => {
  it("funciona sem API e não chama outro modelo", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const request = vi.fn(); vi.stubGlobal("fetch", request);
    expect(await suggestNextAction()).toMatchObject({ source: "rules", taskId: "t1" });
    expect(request).not.toHaveBeenCalled();
  });
  it("recusa escolha inventada ou confiança baixa e aceita apenas id existente", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "private-key");
    for (const [choice, confidence, expected] of [["inventada", 1, "rules"], ["t2", 0.2, "rules"], ["t2", 0.9, "jev"]] as const) {
      vi.stubGlobal("fetch", vi.fn(async () => Response.json({ answers: { proxima: { choice, confidence, probabilities: { [choice]: 0.95 } } } })));
      const result = await suggestNextAction();
      expect(result.source).toBe(expected);
      expect(JSON.stringify(result)).not.toContain("private-key");
    }
  });
  it("usa a API de decisões do OpenRouter e não o endpoint de chat", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "private-key");
    const request = vi.fn(async () => Response.json({ answers: { proxima: { choice: "t1", confidence: 0.95, probabilities: { t1: 0.98 } } } }));
    vi.stubGlobal("fetch", request);
    await suggestNextAction();
    expect(request).toHaveBeenCalledWith("https://openrouter.ai/api/alpha/decisions", expect.objectContaining({ method: "POST" }));
    const body = JSON.parse((request.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.model).toBe("typesafe/jev-1.14");
    expect(body.messages).toBeUndefined();
    expect(body.questions.proxima.type).toBe("choice");
  });
});
