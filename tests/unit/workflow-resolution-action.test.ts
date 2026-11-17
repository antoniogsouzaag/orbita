import { afterEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => vi.fn(async () => {}));
const overview = vi.hoisted(() => vi.fn());
const resolve = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/lib/auth", () => ({ requireAuth: auth }));
vi.mock("@/server/ops", () => ({ n8nOverview: overview }));
vi.mock("@/server/workflow-failures", () => ({ resolveVerifiedWorkflowFailure: resolve }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { resolveWorkflowFailureAction } from "@/app/actions/incidents";
afterEach(() => { vi.clearAllMocks(); });
it("não consulta URL do cliente nem persiste execução ausente da origem", async () => {
  const request = vi.spyOn(globalThis, "fetch");
  overview.mockResolvedValueOnce({ instances: [{ errors: [] }] });
  await expect(resolveWorkflowFailureAction({ url: "https://untrusted.example/private", evidence: "Conferido pelo proprietário" })).rejects.toThrow("Execução não disponível");
  expect(request).not.toHaveBeenCalled();
  expect(resolve).not.toHaveBeenCalled();
  request.mockRestore();
});
it("usa metadados verificados e exige autenticação", async () => {
  const execution = { url: "https://n8n.example/workflow/f/executions/1" };
  overview.mockResolvedValueOnce({ instances: [{ errors: [execution] }] });
  expect(await resolveWorkflowFailureAction({ url: execution.url, evidence: "Correção verificada na origem" })).toEqual({ resolved: true });
  expect(resolve).toHaveBeenCalledWith(execution, "Correção verificada na origem");
  auth.mockRejectedValueOnce(new Error("unauthorized"));
  await expect(resolveWorkflowFailureAction({ url: execution.url, evidence: "Correção verificada na origem" })).rejects.toThrow("unauthorized");
  expect(overview).toHaveBeenCalledTimes(1);
});
