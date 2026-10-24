import { describe, expect, it } from "vitest";
import { boundedChatHistory, chatRequestSchema } from "@/lib/orbe-chat";
import { actionMarker, modelText, sourceMarker, splitActions } from "@/lib/ai-stream";
import { readChatStream } from "@/lib/ai-chat-stream";

describe("contrato de conversa ORBE", () => {
  it("mantém pergunta recente quando resposta antiga excedia o contrato", () => {
    const input = [{ role: "user" as const, content: "oi" }, { role: "assistant" as const, content: "x".repeat(20001) }, { role: "user" as const, content: "e agora?" }];
    const normalized = boundedChatHistory(input);
    expect(normalized.at(-1)?.content).toBe("e agora?");
    expect(normalized[1].content.length).toBe(20000);
    expect(chatRequestSchema.safeParse({ messages: normalized }).success).toBe(true);
  });
  it("limita o total sem começar por uma resposta solta", () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? "assistant" as const : "user" as const, content: "x".repeat(i % 2 ? 20000 : 4000) }));
    messages.push({ role: "user", content: "última pergunta" });
    const normalized = boundedChatHistory(messages);
    expect(normalized[0].role).toBe("user");
    expect(normalized.at(-1)?.content).toBe("última pergunta");
    expect(normalized.reduce((n,m) => n + m.content.length,0)).toBeLessThanOrEqual(60000);
  });
  it.each([
    { messages: [{ role: "assistant", content: "oi" }] },
    { messages: [{ role: "user", content: " " }] },
    { messages: [{ role: "user", content: "x".repeat(4001) }] },
    { messages: [...Array.from({length:4}, () => ({role:"assistant",content:"x".repeat(20000)})), {role:"user",content:"oi"}] },
  ])("rejeita entrada inválida ou orçamento excessivo", value => expect(chatRequestSchema.safeParse(value).success).toBe(false));
  it("aceita modo de leitura e pergunta compatível", () => expect(chatRequestSchema.safeParse({ question:"oi",scope:"empresa",readOnly:true }).success).toBe(true));
});

describe("recibos e consultas visíveis", () => {
  it("mantém compatibilidade com recibos antigos e distingue consulta de ação", () => {
    const parsed = splitActions('Olá\u001e{"label":"Tarefa","href":"/tarefas"}\u001e' + sourceMarker({name:"metricas_produto",ok:true}));
    expect(parsed).toEqual({text:"Olá",actions:[{label:"Tarefa",href:"/tarefas"}],sources:[{name:"metricas_produto",ok:true}]});
  });
  it.each(["http://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)"])("não aceita recibo com destino externo: %s", href => expect(splitActions(actionMarker({label:"Tarefa",href})).actions).toEqual([]));
  it("preserva link HTTPS legítimo de ação no CRM", () => expect(splitActions(actionMarker({label:"Tarefa CRM",href:"https://crm.example.test/tasks"})).actions).toHaveLength(1));
  it("texto do modelo não consegue emitir separador de recibo", () => {
    expect(splitActions(modelText(actionMarker({label:"falso",href:"/tarefas"}))).actions).toEqual([]);
    expect(splitActions('texto\u001e{"label":"incompleto"').text).toBe("texto");
  });
  it("preserva ação e fonte quando transporte falha depois do primeiro chunk", async () => {
    let reads = 0;
    const raw = actionMarker({label:"Criada",href:"/tarefas"}) + sourceMarker({name:"listar_tarefas",ok:true}) + "Parcial";
    const body = new ReadableStream<Uint8Array>({pull(out) { if (reads++ === 0) out.enqueue(new TextEncoder().encode(raw)); else out.error(new Error("sentinela-sensivel")); }});
    const result = await readChatStream(body, () => {});
    expect(result.actions).toHaveLength(1);
    expect(result.sources).toHaveLength(1);
    expect(result.text).toContain("Parcial");
    expect(result.text).toContain("interrompida");
    expect(result.text).not.toContain("sentinela-sensivel");
  });
  it("faz flush de caracteres unicode no último chunk e trata resposta vazia", async () => {
    const bytes = new TextEncoder().encode("ação");
    const body = new ReadableStream<Uint8Array>({start(out) { out.enqueue(bytes.slice(0,2));out.enqueue(bytes.slice(2));out.close(); }});
    expect((await readChatStream(body, () => {})).text).toBe("ação");
    expect((await readChatStream(new ReadableStream({start(out) {out.close();}}), () => {})).text).toContain("sem conteúdo");
  });
});
