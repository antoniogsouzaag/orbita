import http from "node:http";
import type { AddressInfo } from "node:net";
import { askStream, aiProvider, planDay } from "@/server/ai";
import { splitActions, STREAM_END_MARK } from "@/lib/ai-stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Servidor falso que imita a API de Responses da OpenAI (sem chamar a internet).
let server: http.Server;
const requests: Record<string, unknown>[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const json = JSON.parse(body || "{}");
      requests.push(json);
      if (json.stream) {
        res.writeHead(200, { "content-type": "text/event-stream" });
        const send = (type: string, data: object) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
        send("response.created", { sequence_number: 0, response: { id: "r1", status: "in_progress", output: [] } });
        send("response.output_text.delta", { sequence_number: 1, item_id: "m1", output_index: 0, content_index: 0, delta: "Olá, " });
        send("response.output_text.delta", { sequence_number: 2, item_id: "m1", output_index: 0, content_index: 0, delta: "Antonio!" });
        send("response.completed", { sequence_number: 3, response: { id: "r1", status: "completed", output: [] } });
        res.end();
        return;
      }
      const plan = { summary: "Dia focado", blocks: [{ start: "10:00", end: "11:00", title: "Foco na AG LABS", kind: "foco", note: null }, { start: "09:00", end: "09:30", title: "Revisar e-mails", kind: "rotina", note: "rápido" }] };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          id: "r2", object: "response", created_at: 0, status: "completed", model: json.model,
          output: [{ type: "message", id: "m2", status: "completed", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(plan), annotations: [] }] }],
        }),
      );
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.OPENAI_MODEL = "gpt-6-luna";
});
afterAll(() => server?.close());

describe("IA via OpenAI", () => {
  it("transmite a resposta em texto e envia o contexto do dia", async () => {
    expect(aiProvider()).toBe("openai");
    const stream = await askStream([{ role: "user", content: "O que faço hoje?" }]);
    const text = await new Response(stream).text();
    expect(splitActions(text).text).toBe("Olá, Antonio!");
    expect(text.endsWith(STREAM_END_MARK)).toBe(true);
    const req = requests.at(-1) as { model: string; instructions: string; input: { role: string; content: string }[]; store: boolean };
    expect(req.model).toBe("gpt-6-luna");
    expect(req.store).toBe(false);
    expect(req.instructions).toContain("Órbita");
    expect(req.input.at(-1)!.content).toContain("<contexto_do_dia>");
    expect(req.input.at(-1)!.content).toContain("O que faço hoje?");
  });

  it("investiga prioridades empresariais com metas, projetos e orientação estratégica", async () => {
    const stream = await askStream([{role:"user",content:"O que a empresa deve priorizar hoje?"}],{scope:"empresa"});
    await new Response(stream).text();
    const req = requests.at(-1) as {instructions:string; input:{content:string}[]; reasoning:{effort:string};tools:{name:string}[]};
    expect(req.instructions).toContain("prioridade estratégica");
    expect(req.instructions).toContain("não significam ausência de prioridades");
    expect(req.input.at(-1)!.content).toContain("Metas empresariais ativas");
    expect(req.input.at(-1)!.content).toContain("Projetos da empresa");
    expect(req.reasoning.effort).toBe("medium");
    expect(req.tools.map(tool => tool.name)).toEqual(expect.arrayContaining(["listar_metas","criar_meta","buscar_no_vault","ler_nota_do_vault"]));
  });

  it("monta o plano do dia com saída estruturada e ordena os blocos", async () => {
    const plan = await planDay({ prompt: "", from: 8, to: 22 });
    expect(plan.summary).toBe("Dia focado");
    expect(plan.blocks.map((b) => b.start)).toEqual(["09:00", "10:00"]);
    const req = requests.at(-1) as { text: { format: { type: string; name: string; strict: boolean } } };
    expect(req.text.format).toMatchObject({ type: "json_schema", name: "plano_do_dia", strict: true });
  });
});
