import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { POST } from "@/app/api/mcp/route";
import { getDb } from "@/db";
import { dispatches, opsEvents } from "@/db/schema";
import { createAgentToken } from "@/server/agents";
import { dispatchOpenclaw, openclawHeaders } from "@/server/openclaw";
import { isSilent, listDispatches } from "@/server/dispatch";

const TOKEN = "a".repeat(64);
let n = 0;
async function call(token: string, name: string, args: object = {}) {
  const res = await POST(new Request("http://localhost/api/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${token}` }, body: JSON.stringify({ jsonrpc: "2.0", id: ++n, method: "tools/call", params: { name, arguments: args } }) }));
  const body = (await res.json()) as { result?: { content: { text: string }[]; isError?: boolean } };
  return { text: body.result?.content.map((c) => c.text).join("\n") ?? JSON.stringify(body), isError: !!body.result?.isError };
}
const admitted = (runId = "run-1") => vi.fn(async () => Response.json({ ok: true, runId }));

beforeAll(async () => {
  const db = await getDb();
  await db.delete(dispatches);
  await db.delete(opsEvents);
});
beforeEach(() => {
  vi.stubEnv("OPENCLAW_DISPATCH_ENABLED", "true");
  vi.stubEnv("OPENCLAW_HOOK_URL", "https://tom.example/hooks/orbita");
  vi.stubEnv("OPENCLAW_HOOK_TOKEN", TOKEN);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("saída Órbita → OpenClaw", () => {
  it("grava antes de enviar e usa o id como chave de idempotência", async () => {
    const db = await getDb();
    const fetcher = vi.fn(async (_url: URL, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      const [row] = await db.select().from(dispatches).where(eq(dispatches.id, body.request_id));
      expect(row.status).toBe("sending");
      expect(body).toEqual({ version: 1, source: "orbita", request_id: row.id, action: "request.tom", params: { texto: "Revisar memória do VPS-02" } });
      expect(init.headers).toEqual(openclawHeaders(TOKEN, row.id));
      expect(init.redirect).toBe("manual");
      return Response.json({ ok: true, runId: "run-abc" });
    });
    vi.stubGlobal("fetch", fetcher);
    const sent = await dispatchOpenclaw({ action: "request.tom", params: { texto: "Revisar memória do VPS-02" } });
    expect(sent).toMatchObject({ status: "accepted", runId: "run-abc", target: "openclaw" });
    expect(String(fetcher.mock.calls[0][0])).toBe("https://tom.example/hooks/orbita");
    expect(JSON.stringify(sent)).not.toContain(TOKEN);
  });

  it("204 vira recusado; erro e status inesperado viram incerto, sem nova tentativa", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    expect((await dispatchOpenclaw({ action: "diagnostics.read", params: {} })).status).toBe("rejected");
    const failing = vi.fn(async () => { throw new Error("socket"); });
    vi.stubGlobal("fetch", failing);
    expect((await dispatchOpenclaw({ action: "diagnostics.read", params: {} })).status).toBe("unknown");
    expect(failing).toHaveBeenCalledTimes(1);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 503 })));
    expect((await dispatchOpenclaw({ action: "diagnostics.read", params: {} })).detail).toContain("503");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true })));
    expect((await dispatchOpenclaw({ action: "diagnostics.read", params: {} })).status).toBe("unknown");
  });

  it("não envia sem ativação, fora da rota dedicada ou com contrato ampliado", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    vi.stubEnv("OPENCLAW_DISPATCH_ENABLED", "false");
    expect((await dispatchOpenclaw({ action: "diagnostics.read", params: {} })).status).toBe("unknown");
    vi.stubEnv("OPENCLAW_DISPATCH_ENABLED", "true");
    vi.stubEnv("OPENCLAW_HOOK_URL", "https://tom.example/hooks/agent");
    expect((await dispatchOpenclaw({ action: "diagnostics.read", params: {} })).detail).toContain("/hooks/orbita");
    vi.stubEnv("OPENCLAW_HOOK_URL", "https://tom.example/hooks/orbita");
    vi.stubEnv("OPENCLAW_HOOK_TOKEN", "curto");
    expect((await dispatchOpenclaw({ action: "diagnostics.read", params: {} })).status).toBe("unknown");
    await expect(dispatchOpenclaw({ action: "diagnostics.read", params: { comando: "rm" } } as never)).rejects.toThrow();
    await expect(dispatchOpenclaw({ action: "exec.shell", params: {} } as never)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("retorno do diretor pelo MCP", () => {
  it("lista pedidos abertos e registra execução e resultado uma única vez", async () => {
    vi.stubGlobal("fetch", admitted("run-mcp"));
    const sent = await dispatchOpenclaw({ action: "incident.diagnose", params: { assunto: "lembrete whats barberias falhando" } });
    const tom = await createAgentToken("Tom · OpenClaw", ["eventos"]);

    const open = await call(tom, "pedidos_recebidos", { destino: "openclaw" });
    expect(open.text).toContain(sent.id);
    expect(open.text).toContain("lembrete whats barberias");

    expect((await call(tom, "registrar_resultado", { pedido_id: sent.id, estado: "em_execucao", resumo: "Diagnóstico iniciado" })).isError).toBe(false);
    expect((await listDispatches({ target: "openclaw" })).find((d) => d.id === sent.id)?.status).toBe("running");

    const done = { pedido_id: sent.id, estado: "concluido", resumo: "Falha no envio do WhatsApp do VPS-01; Hermes EasyPanel deve renovar a sessão.", evidencia: "https://n8na.example/workflow/1/executions/2" };
    expect((await call(tom, "registrar_resultado", done)).text).toContain("Resultado registrado");
    expect((await call(tom, "registrar_resultado", done)).text).toContain("já registrado");
    const reopen = await call(tom, "registrar_resultado", { pedido_id: sent.id, estado: "falhou", resumo: "outro" });
    expect(reopen.isError).toBe(true);

    const row = (await listDispatches({ target: "openclaw" })).find((d) => d.id === sent.id)!;
    expect(row).toMatchObject({ status: "completed", reportedBy: "Tom · OpenClaw", evidence: done.evidencia });
    expect(row.finishedAt).toBeInstanceOf(Date);
    expect((await call(tom, "pedidos_recebidos", {})).text).not.toContain(sent.id);
    expect((await call(tom, "registrar_resultado", { pedido_id: crypto.randomUUID(), estado: "concluido", resumo: "inexistente" })).isError).toBe(true);
  });

  it("marca como sem retorno o pedido aceito parado há mais de duas horas", () => {
    const old = new Date(Date.now() - 3 * 3_600_000);
    expect(isSilent({ status: "accepted", updatedAt: old })).toBe(true);
    expect(isSilent({ status: "completed", updatedAt: old })).toBe(false);
    expect(isSilent({ status: "running", updatedAt: new Date() })).toBe(false);
  });

  it("eventos_recentes devolve o relato do próprio agente com filtro de origem", async () => {
    const token = await createAgentToken("Sys", ["status", "eventos"]);
    await call(token, "registrar_evento", { tipo: "resumo", assunto: "Revisão semanal do VPS-02", detalhe: "Sem pendências críticas" });
    const mine = await call(token, "eventos_recentes", { origem: "agente:sys" });
    expect(mine.text).toContain("Revisão semanal do VPS-02");
    expect(mine.text).toContain("agente_resumo");
    expect((await call(token, "eventos_recentes", { origem: "agente:outro" })).text).toContain("Nenhum evento");
    expect((await call(token, "eventos_recentes", { origem: "agente:%" })).text).toContain("Nenhum evento");
  });
});
