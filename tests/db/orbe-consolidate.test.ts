import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
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
    await saveConversation(id, { scope: "pessoal", messages: [{ role: "user", content: "Qual o status do dia?" }, { role: "assistant", content: "Tudo no ar." }, { role: "user", content: "Me dá o resultado primeiro, por favor." }, { role: "assistant", content: "Combinado." }] });
    const db = await getDb();
    await db.update(orbeConversations).set({ updatedAt: new Date(Date.now() - 2 * 3_600_000) });

    const { GET } = await import("@/app/api/cron/orbe/route");
    expect((await GET(new Request("http://x/api/cron/orbe"))).status).toBe(401);
    const res = await GET(new Request("http://x/api/cron/orbe", { headers: { authorization: "Bearer cron-secret-for-tests-123" } }));
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, consolidated: 1, skippedWithoutModel: 0, failed: 0, memoryChanges: 1 });
    expect(requests[0].tools?.map((t) => t.name)).toEqual(["memoria"]);
    expect(requests[0].instructions).toContain("sem Antonio presente");
    expect((await listMemories(["geral"]))[0].content).toBe("Prefere o resultado na primeira frase.");
    const [row] = await db.select().from(orbeConversations);
    expect(row.consolidatedAt).not.toBeNull();
  }, 120_000);

  const auth = { headers: { authorization: "Bearer cron-secret-for-tests-123" } };
  async function seed(id: string, userTurns: number) {
    await (await getDb()).delete(orbeConversations);
    const messages = Array.from({ length: userTurns }, (_, i) => [{ role: "user" as const, content: `Pergunta ${i}` }, { role: "assistant" as const, content: `Resposta ${i}` }]).flat();
    await saveConversation(id, { scope: "empresa", messages });
    const db = await getDb();
    await db.update(orbeConversations).set({ updatedAt: new Date(Date.now() - 2 * 3_600_000) });
  }
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  beforeAll(async () => { await import("@/app/api/cron/orbe/route"); }, 120_000);

  it("conversa curta é consolidada sem chamar a IA", async () => {
    const before = requests.length;
    await seed("7b1e2f3a-4c5d-4e6f-8a9b-0c1d2e3f4a5b", 1);
    const { GET } = await import("@/app/api/cron/orbe/route");
    const body = await (await GET(new Request("http://x/api/cron/orbe", auth))).json();
    expect(body).toMatchObject({ consolidated: 1, skippedWithoutModel: 1, memoryChanges: 0 });
    expect(requests.length).toBe(before);
  });

  it("com o porteiro Jev, 'nada' firme evita o modelo que escreve; dúvida segue", async () => {
    vi.stubEnv("ORBE_CONSOLIDATION_GATE", "jev");
    vi.stubEnv("OPENROUTER_API_KEY", "or-test-key");
    const real = globalThis.fetch;
    let confidence = 0.95;
    vi.stubGlobal("fetch", async (url: RequestInfo | URL, init?: RequestInit) => String(url).includes("openrouter.ai")
      ? new Response(JSON.stringify({ answers: { q: { choice: "nada", confidence, probabilities: { nada: confidence, guardar: 1 - confidence } } } }), { status: 200 })
      : real(url, init));
    const { GET } = await import("@/app/api/cron/orbe/route");
    const before = requests.length;
    await seed("8c2f3a4b-5d6e-4f7a-9b0c-1d2e3f4a5b6c", 3);
    expect(await (await GET(new Request("http://x/api/cron/orbe", auth))).json()).toMatchObject({ consolidated: 1, skippedWithoutModel: 1 });
    expect(requests.length).toBe(before);
    confidence = 0.55;
    await seed("9d3a4b5c-6e7f-4a8b-8c1d-2e3f4a5b6c7d", 3);
    expect(await (await GET(new Request("http://x/api/cron/orbe", auth))).json()).toMatchObject({ consolidated: 1, skippedWithoutModel: 0 });
    expect(requests.length).toBeGreaterThan(before);
  });

  it("pausada não chama IA nem apaga nada", async () => {
    vi.stubEnv("ORBE_CONSOLIDATION_ENABLED", "false");
    const { GET } = await import("@/app/api/cron/orbe/route");
    expect(await (await GET(new Request("http://x/api/cron/orbe", auth))).json()).toEqual({ ok: true, paused: true });
  });
});
