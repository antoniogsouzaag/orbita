import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearCrmCache, crmCall } from "@/server/crm";
beforeEach(() => { clearCrmCache(); vi.stubEnv("CRM_MCP_URL", "https://crm.example.test/api/mcp"); vi.stubEnv("CRM_MCP_TOKEN", "fixture-only"); });
afterEach(() => { clearCrmCache(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("reutiliza só agregados autorizados, isolando argumentos, origem e credencial", async () => {
  const fetcher = vi.fn(async () => Response.json({ result: { structuredContent: { status: "ok", data: { value: 0 } } } }));
  vi.stubGlobal("fetch", fetcher);
  await Promise.all([crmCall("crm_metricas_produto", { produto: "viajeki" }), crmCall("crm_metricas_produto", { produto: "viajeki" })]);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await crmCall("crm_metricas_produto", { produto: "mecard" }); expect(fetcher).toHaveBeenCalledTimes(2);
  vi.stubEnv("CRM_MCP_TOKEN", "other-fixture"); await crmCall("crm_metricas_produto", { produto: "viajeki" }); expect(fetcher).toHaveBeenCalledTimes(3);
  vi.stubEnv("CRM_MCP_URL", "https://other.example.test/api/mcp"); await crmCall("crm_metricas_produto", { produto: "viajeki" }); expect(fetcher).toHaveBeenCalledTimes(4);
  clearCrmCache(); await crmCall("crm_metricas_produto", { produto: "viajeki" }); expect(fetcher).toHaveBeenCalledTimes(5);
  await crmCall("crm_tarefas"); await crmCall("crm_tarefas"); expect(fetcher).toHaveBeenCalledTimes(7);
});
it("não mantém indisponibilidade ou falha de rede no cache", async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(Response.json({ result: { structuredContent: { status: "unavailable", data: null } } }))
    .mockResolvedValueOnce(Response.json({ result: { structuredContent: { status: "ok", data: { value: 0 } } } }));
  vi.stubGlobal("fetch", fetcher);
  await expect(crmCall("crm_metricas_produto")).rejects.toThrow("offline");
  expect(await crmCall("crm_metricas_produto")).toMatchObject({ status: "unavailable" });
  expect(await crmCall("crm_metricas_produto")).toMatchObject({ status: "ok" }); expect(fetcher).toHaveBeenCalledTimes(3);
});
