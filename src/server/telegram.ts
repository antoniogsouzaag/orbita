import "server-only";

/**
 * Envio direto pelo Telegram (Bot API), sem passar pelo n8n.
 * Os monitores do n8n continuam com o próprio envio: se a Órbita cair, os alertas não param.
 */
export function telegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function sendTelegram(html: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return { ok: false, error: "Telegram não configurado (TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID)." };
  // limite do Telegram: 4096 caracteres por mensagem
  const chunks = html.length <= 4000 ? [html] : html.match(/[\s\S]{1,4000}(?=\n|$)/g) ?? [html.slice(0, 4000)];
  for (const text of chunks) {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    }).catch((e: unknown) => e as Error);
    if (res instanceof Error) return { ok: false, error: res.message };
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { description?: string };
      return { ok: false, error: `Telegram ${res.status}: ${body.description ?? "erro"}` };
    }
  }
  return { ok: true };
}
