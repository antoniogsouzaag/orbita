import { askStream } from "@/server/ai";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { tasks } from "@/db/schema";

// OpenAI falsa: 1ª chamada pede a ferramenta criar_tarefa; 2ª (com o resultado) responde em texto.
let server: http.Server;
const requests: { input: { type?: string; role?: string; output?: string }[]; tools?: { name: string }[]; include?: string[] }[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const json = JSON.parse(body || "{}");
      requests.push(json);
      res.writeHead(200, { "content-type": "text/event-stream" });
      const send = (type: string, data: object) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
      const answered = json.input.some((i: { type?: string }) => i.type === "function_call_output");
      send("response.created", { sequence_number: 0, response: { id: "r", status: "in_progress", output: [] } });
      if (!answered) {
        const call = { type: "function_call", id: "fc_1", call_id: "call_1", name: "criar_tarefa", status: "completed", arguments: JSON.stringify({ titulo: "Revisar proposta da Gabi", prazo: "2026-10-24", hora: "10:00", prioridade: "alta" }) };
        send("response.completed", { sequence_number: 1, response: { id: "r1", status: "completed", output: [{ type: "reasoning", id: "rs_1", summary: [], encrypted_content: "x" }, call] } });
      } else {
        send("response.output_text.delta", { sequence_number: 1, item_id: "m", output_index: 0, content_index: 0, delta: "Pronto: tarefa criada para amanhã às 10h." });
        send("response.completed", { sequence_number: 2, response: { id: "r2", status: "completed", output: [] } });
      }
      res.end();
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.OPENAI_MODEL = "gpt-6-luna";
  const db = await getDb();
  await db.delete(tasks);
});
afterAll(() => server?.close());

describe("IA com ações", () => {
  it("executa a ferramenta, devolve o resultado ao modelo e marca a ação no fluxo", async () => {
    const { splitActions } = await import("@/lib/ai-stream");
    const raw = await new Response(await askStream([{ role: "user", content: "cria tarefa revisar proposta da Gabi amanhã 10h, alta" }])).text();
    const { text, actions } = splitActions(raw);
    expect(text).toBe("Pronto: tarefa criada para amanhã às 10h.");
    expect(actions).toEqual([{ label: "Tarefa: Revisar proposta da Gabi", href: "/tarefas" }]);

    const db = await getDb();
    const [t] = await db.select().from(tasks);
    expect(t).toMatchObject({ title: "Revisar proposta da Gabi", dueDate: "2026-10-24", dueTime: "10:00", priority: 3 });

    expect(requests[0].tools?.map((x) => x.name)).toContain("criar_tarefa");
    expect(requests[0].include).toContain("reasoning.encrypted_content");
    const second = requests[1].input;
    expect(second.some((i) => i.type === "reasoning")).toBe(true); // raciocínio devolvido junto com a chamada
    expect(second.find((i) => i.type === "function_call_output")?.output).toContain("Tarefa criada");
  });

  it("valida argumentos e não quebra com ferramenta desconhecida", async () => {
    const { runAssistantTool } = await import("@/server/assistant");
    expect((await runAssistantTool("apagar_tudo", "{}")).ok).toBe(false);
    const bad = await runAssistantTool("criar_tarefa", JSON.stringify({ titulo: "x", prazo: "amanhã" }));
    expect(bad.ok).toBe(false);
    expect(bad.text).toContain("prazo");
  });

  it("lista, conclui e registra gasto", async () => {
    const { runAssistantTool } = await import("@/server/assistant");
    const list = await runAssistantTool("listar_tarefas", { visao: "todas" });
    const id = /id ([0-9a-f-]{36})/.exec(list.text)![1];
    const done = await runAssistantTool("atualizar_tarefa", { id, status: "done" });
    expect(done.text).toContain("concluída");
    const db = await getDb();
    const [t] = await db.select().from(tasks);
    expect(t.status).toBe("done");
    expect(t.completedAt).not.toBeNull();
    const g = await runAssistantTool("registrar_lancamento", { descricao: "Almoço", valor: 32.5 });
    expect(g.ok).toBe(true);
    expect(g.text).toContain("R$");
  });
});
