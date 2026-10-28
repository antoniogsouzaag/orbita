import { afterEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/mcp/route";
import { createAgentToken, verifyAgentToken } from "@/server/agents";
import { getDb } from "@/db";
import { tasks, dispatches } from "@/db/schema";
import { eq } from "drizzle-orm";
async function rpc(token: string, method: string, params: object) {
 const response = await POST(new Request("http://localhost/api/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${token}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }));
 return response.json();
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("MCP usa grant autenticado tarefas/admin, não o nome; atribuição fora do brief e readback de contexto só do dono", async () => {
 const restricted = await createAgentToken("Hermes Oracle", ["status"]);
 const sender = await createAgentToken("Agente coordenador", ["tarefas"]);
 const admin = await createAgentToken("Administrador externo", ["admin"]);
 const worker = await createAgentToken("Hermes Oracle", ["tarefas"]);
 for (const token of [sender, admin]) {
  const list = await rpc(token, "tools/list", {});
  expect(list.result.tools.map((t: { name: string }) => t.name)).toContain("encaminhar_trabalho_hermes");
 }
 const denied = await rpc(restricted, "tools/call", { name: "encaminhar_trabalho_hermes", arguments: { title: "Negado", brief: "Investigar", acceptance: "Teste" } });
 expect(JSON.stringify(denied)).toMatch(/not found|error/i);
 vi.stubEnv("HERMES_DISPATCH_ENABLED", "true"); vi.stubEnv("HERMES_WEBHOOK_URL", "https://hermes.example/webhooks/orbita-hermes"); vi.stubEnv("HERMES_WEBHOOK_SECRET", "test");
 vi.stubGlobal("fetch", vi.fn(async (_url, init) => { const body = JSON.parse(init.body); return Response.json({ request_id: body.request_id, action: body.action, status: "accepted" }, { status: 202 }); }));
 const sent = await rpc(sender, "tools/call", { name: "encaminhar_trabalho_hermes", arguments: { title: "Analisar genericamente", brief: "Investigue sem shell direto", acceptance: "Testes reais" } });
 expect(sent.result?.structuredContent).toMatchObject({ action: "task.dispatch", status: "accepted" });
 const operation = sent.result.structuredContent;
 const db = await getDb();
 const [row] = await db.select().from(dispatches).where(eq(dispatches.id, operation.id));
 expect(row.origin).toMatchObject({ id: (await verifyAgentToken(sender))!.id, name: "Agente coordenador", kind: "mcp" });
 const own = await rpc(worker, "tools/call", { name: "consultar_minha_tarefa", arguments: { id: operation.taskId } });
 expect(own.result.structuredContent).toMatchObject({ title: "Analisar genericamente", assignee: "Hermes Oracle", context: { brief: "Investigue sem shell direto", acceptance: "Testes reais" } });
 expect(JSON.stringify(own)).not.toContain("Agente coordenador");
 const other = await rpc(admin, "tools/call", { name: "consultar_minha_tarefa", arguments: { id: operation.taskId } });
 expect(other.result.isError).toBe(true);
 const [task] = await db.select().from(tasks).where(eq(tasks.id, operation.taskId));
 expect(task.status).toBe("todo");
});
