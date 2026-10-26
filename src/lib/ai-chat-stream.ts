import { chatParts, splitActions, STREAM_END_MARK, type ChatPart } from "./ai-stream";
export type ChatSnapshot = ReturnType<typeof splitActions> & { parts: ChatPart[] };

function snapshot(raw: string, trustedOrigins: string[]): ChatSnapshot { return { ...splitActions(raw, trustedOrigins), parts: chatParts(raw) }; }
/** Acrescenta um aviso ao texto e às partes ordenadas. */
function withNotice(value: ChatSnapshot, notice: string, replace = false): ChatSnapshot {
  const parts = replace ? value.parts.filter(p => p.type !== "text") : [...value.parts];
  return { ...value, text: replace ? notice : value.text + notice, parts: [...parts, { type: "text", text: notice }] };
}

/** Preserva recibos já recebidos mesmo quando transporte/cancelamento interrompe o texto. */
export async function readChatStream(body: ReadableStream<Uint8Array>, onUpdate: (value: ChatSnapshot) => void, trustedOrigins: string[] = []): Promise<ChatSnapshot> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  let parsed = snapshot(raw, trustedOrigins);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += decoder.decode(value, { stream: true });
      parsed = snapshot(raw, trustedOrigins);
      onUpdate(parsed);
    }
    raw += decoder.decode();
    parsed = snapshot(raw, trustedOrigins);
    if (!parsed.text.trim()) parsed = withNotice(parsed, "⚠️ A resposta terminou sem conteúdo. Consultas e recibos recebidos foram preservados; nenhuma conclusão adicional foi confirmada.", true);
    else if (!raw.endsWith(STREAM_END_MARK)) parsed = withNotice(parsed, "\n\n⚠️ A transmissão terminou antes de confirmar o fim da análise. O texto, as consultas e os recibos recebidos foram preservados; confira o estado antes de repetir qualquer ação.");
  } catch {
    parsed = withNotice(parsed, "\n\n⚠️ Resposta interrompida. Recibos recebidos foram preservados; uma ação já iniciada pode concluir. Confira o estado antes de repetir.");
  } finally {
    reader.releaseLock();
  }
  onUpdate(parsed);
  return parsed;
}
