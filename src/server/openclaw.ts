import "server-only";
import { z } from "zod";
import { createDispatch, updateDispatch } from "./dispatch";

/**
 * Saída Órbita → OpenClaw (Tom, VPS-02).
 * POST na rota mapeada /hooks/orbita do gateway com Bearer dedicado e Idempotency-Key = id do pedido.
 * O gateway valida o contrato num transform com lista fechada de ações e abre um turno isolado do agente main.
 * A resposta HTTP só confirma admissão; execução e resultado chegam pelo MCP (registrar_resultado).
 */

export const openclawCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("diagnostics.read"), params: z.object({}).strict() }).strict(),
  z.object({ action: z.literal("incident.diagnose"), params: z.object({ assunto: z.string().trim().min(3).max(200), detalhe: z.string().trim().max(2000).optional(), evento_id: z.uuid().optional() }).strict() }).strict(),
  z.object({ action: z.literal("request.tom"), params: z.object({ texto: z.string().trim().min(3).max(2000) }).strict() }).strict(),
]);
export type OpenclawCommand = z.infer<typeof openclawCommand>;

export const OPENCLAW_ACTION_LABEL: Record<OpenclawCommand["action"], string> = {
  "diagnostics.read": "Diagnóstico do VPS-02",
  "incident.diagnose": "Diagnóstico de incidente",
  "request.tom": "Pedido ao Tom",
};

export function openclawConfiguration() {
  return { enabled: process.env.OPENCLAW_DISPATCH_ENABLED === "true", endpointConfigured: !!process.env.OPENCLAW_HOOK_URL, tokenConfigured: (process.env.OPENCLAW_HOOK_TOKEN?.trim().length ?? 0) >= 32 };
}

export function openclawHeaders(token: string, id: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Idempotency-Key": id, "X-Request-Id": id };
}

function endpoint() {
  const url = new URL(process.env.OPENCLAW_HOOK_URL!);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !/\/hooks\/orbita\/?$/.test(url.pathname)) throw new Error("Use a rota HTTPS dedicada /hooks/orbita do gateway.");
  return url;
}

/** Persiste antes do envio e não repete automaticamente: resposta incerta fica "unknown" para conferência. */
export async function dispatchOpenclaw(input: OpenclawCommand) {
  const command = openclawCommand.parse(input);
  const config = openclawConfiguration();
  const id = crypto.randomUUID();
  await createDispatch({ id, target: "openclaw", action: command.action, params: command.params });
  if (!config.enabled || !config.endpointConfigured || !config.tokenConfigured) return updateDispatch(id, { status: "unknown", detail: "Despacho não ativado. Configure rota, token dedicado e habilitação no servidor." });
  try {
    const body = JSON.stringify({ version: 1, source: "orbita", request_id: id, action: command.action, params: command.params });
    const response = await fetch(endpoint(), { method: "POST", headers: openclawHeaders(process.env.OPENCLAW_HOOK_TOKEN!.trim(), id), body, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (response.status === 204) return updateDispatch(id, { status: "rejected", detail: "O gateway recusou o contrato do pedido (204). Nada foi executado." });
    if (response.status !== 200) return updateDispatch(id, { status: "unknown", detail: `Gateway respondeu HTTP ${response.status}. Confira antes de reenviar.` });
    const payload = (await response.json().catch(() => null)) as { ok?: boolean; runId?: string } | null;
    if (!payload?.ok || typeof payload.runId !== "string") return updateDispatch(id, { status: "unknown", detail: "Resposta sem admissão válida. Confira antes de reenviar." });
    return updateDispatch(id, { status: "accepted", runId: payload.runId.slice(0, 120), detail: "Admitido pelo gateway; aguardando o retorno do Tom." });
  } catch (error) {
    return updateDispatch(id, { status: "unknown", detail: error instanceof Error && error.message.startsWith("Use a rota") ? error.message : "Resultado do envio desconhecido. Confira este pedido antes de reenviar." });
  }
}
