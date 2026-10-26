import { splitActions, STREAM_END_MARK } from "./ai-stream";
export type ChatSnapshot = ReturnType<typeof splitActions>;

/** Preserva recibos já recebidos mesmo quando transporte/cancelamento interrompe o texto. */
export async function readChatStream(body: ReadableStream<Uint8Array>, onUpdate: (value: ChatSnapshot) => void, trustedOrigins: string[] = []): Promise<ChatSnapshot> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  let parsed = splitActions(raw, trustedOrigins);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += decoder.decode(value, { stream: true });
      parsed = splitActions(raw, trustedOrigins);
      onUpdate(parsed);
    }
    raw += decoder.decode();
    parsed = splitActions(raw, trustedOrigins);
    if (!parsed.text.trim()) parsed.text = "⚠️ A resposta terminou sem conteúdo. Consultas e recibos recebidos foram preservados; nenhuma conclusão adicional foi confirmada.";
    else if (!raw.endsWith(STREAM_END_MARK)) parsed.text += "\n\n⚠️ A transmissão terminou antes de confirmar o fim da análise. O texto, as consultas e os recibos recebidos foram preservados; confira o estado antes de repetir qualquer ação.";
  } catch {
    parsed = { ...parsed, text: parsed.text + "\n\n⚠️ Resposta interrompida. Recibos recebidos foram preservados; uma ação já iniciada pode concluir. Confira o estado antes de repetir." };
  } finally {
    reader.releaseLock();
  }
  onUpdate(parsed);
  return parsed;
}
