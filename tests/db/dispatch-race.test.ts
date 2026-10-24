import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { dispatches } from "@/db/schema";
import { dispatchOpenclaw } from "@/server/openclaw";
import { createDispatch, reportDispatchResult, updateDispatch } from "@/server/dispatch";
beforeEach(() => {
  vi.stubEnv("OPENCLAW_DISPATCH_ENABLED", "true");
  vi.stubEnv("OPENCLAW_HOOK_URL", "https://tom.example/hooks/orbita");
  vi.stubEnv("OPENCLAW_HOOK_TOKEN", "a".repeat(64));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("não regride resultado concluído quando admissão chega depois do callback", async () => {
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
    const body = JSON.parse(String(init.body));
    await reportDispatchResult("Tom", { pedido_id: body.request_id, estado: "em_execucao", resumo: "Iniciado" });
    await reportDispatchResult("Tom", { pedido_id: body.request_id, estado: "concluido", resumo: "Verificação concluída", evidencia: "prova" });
    return Response.json({ ok: true, runId: "run-fast" });
  }));
  const row = await dispatchOpenclaw({ action: "diagnostics.read", params: {} });
  expect(row).toMatchObject({ status: "completed", runId: "run-fast", summary: "Verificação concluída", evidence: "prova" });
  expect(row.finishedAt).toBeInstanceOf(Date);
});
it("timeout de transporte não apaga execução já informada pelo agente", async () => {
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
    const body = JSON.parse(String(init.body));
    await reportDispatchResult("Tom", { pedido_id: body.request_id, estado: "em_execucao", resumo: "Iniciado" });
    throw new Error("timeout");
  }));
  expect((await dispatchOpenclaw({ action: "diagnostics.read", params: {} })).status).toBe("running");
});
it("admissão atrasada preserva falha final e seu horário", async () => {
  const id = crypto.randomUUID();
  await createDispatch({ id, target: "openclaw", action: "diagnostics.read", params: {} });
  await reportDispatchResult("Tom", { pedido_id: id, estado: "falhou", resumo: "Ferramenta indisponível" });
  const db = await getDb();
  const [before] = await db.select().from(dispatches).where(eq(dispatches.id, id));
  const after = await updateDispatch(id, { status: "accepted", detail: "admitido", runId: "run-late" });
  expect(after.status).toBe("failed");
  expect(after.updatedAt).toEqual(before.updatedAt);
  expect(after.finishedAt).toEqual(before.finishedAt);
});
it("repetição de resultado exige também evidência idêntica", async () => {
  const id = crypto.randomUUID();
  await createDispatch({ id, target: "openclaw", action: "diagnostics.read", params: {} });
  const input = { pedido_id: id, estado: "concluido" as const, resumo: "Tudo verificado", evidencia: "original" };
  expect((await reportDispatchResult("Tom", input)).ok).toBe(true);
  expect((await reportDispatchResult("Tom", input)).ok).toBe(true);
  expect((await reportDispatchResult("Tom", { ...input, evidencia: "outra" })).ok).toBe(false);
});
it("resultados finais concorrentes não sobrescrevem o vencedor", async () => {
  const id = crypto.randomUUID();
  await createDispatch({ id, target: "openclaw", action: "diagnostics.read", params: {} });
  const results = await Promise.all([
    reportDispatchResult("Tom", { pedido_id: id, estado: "concluido", resumo: "Concluído" }),
    reportDispatchResult("Tom", { pedido_id: id, estado: "falhou", resumo: "Falha" }),
  ]);
  expect(results.filter(r => r.ok)).toHaveLength(1);
});
