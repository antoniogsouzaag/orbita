import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { orbeConversations, orbeMemories } from "@/db/schema";
import { saveConversation } from "@/server/orbe-conversations";
import { listMemories } from "@/server/orbe-memory";

// OpenAI falsa: na consolidação, pede memoria uma vez e depois encerra com uma linha.
let server: http.Server;
const requests: { tools?: { name: string }[]; instructions?: string }[] = [];

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
      if (!answered) {
        const call = { type: "function_call", id: "fc_1", call_id: "call_1", name: "memoria", status: "completed", arguments: JSON.stringify({ acao: "adicionar", espaco: "geral", texto: "Prefere o resultado na primeira frase." }) };
        send("response.completed", { sequence_number: 1, response: { id: "r1", status: "completed", output: [call] } });
      } else {
        send("response.output_text.delta", { sequence_number: 1, item_id: "m", output_index: 0, content_index: 0, delta: "Guardei uma preferência." });
        send("response.completed", { sequence_number: 2, response: { id: "r2", status: "completed", output: [] } });
      }
      res.end();
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.OPENAI_MODEL = "gpt-6-luna";
  process.env.CRON_SECRET = "cron-secret-for-tests-123";
  const db = await getDb();
  await db.delete(orbeMemories);
  await db.delete(orbeConversations);
});
afterAll(() => server?.close());

describe("consolidação diária da ORBE", () => {
  it("revisa a conversa encerrada só com a ferramenta de memória e marca como consolidada", async () => {
    const id = "6a0d1d4e-2c1b-4f3a-9e7d-0b1c2d3e4f50";
    await saveConversation(id, { scope: "pessoal", messages: [{ role: "user", content: "Me dá o resultado primeiro, por favor." }, { role: "assistant", content: "Combinado." }] });
    const db = await getDb();
    await db.update(orbeConversations).set({ updatedAt: new Date(Date.now() - 2 * 3_600_000) });

    const { GET } = await import("@/app/api/cron/orbe/route");
    expect((await GET(new Request("http://x/api/cron/orbe"))).status).toBe(401);
    const res = await GET(new Request("http://x/api/cron/orbe", { headers: { authorization: "Bearer cron-secret-for-tests-123" } }));
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, consolidated: 1, failed: 0, memoryChanges: 1 });
    expect(requests[0].tools?.map((t) => t.name)).toEqual(["memoria"]);
    expect(requests[0].instructions).toContain("sem Antonio presente");
    expect((await listMemories(["geral"]))[0].content).toBe("Prefere o resultado na primeira frase.");
    const [row] = await db.select().from(orbeConversations);
    expect(row.consolidatedAt).not.toBeNull();
  });
});
