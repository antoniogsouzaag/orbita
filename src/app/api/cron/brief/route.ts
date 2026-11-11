import { buildBrief } from "@/server/brief";
import { tokenMatches } from "@/lib/auth";
import { runCron } from "@/server/cron-runs";
import { sendTelegram, telegramConfigured } from "@/server/telegram";

export const maxDuration = 60;

/** Bom dia das 7h (Brasília) pelo Telegram. Disparado pelo agendador interno, com Authorization: Bearer CRON_SECRET. */
export async function GET(req: Request) {
  if (!tokenMatches(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), "CRON_SECRET")) return Response.json({ error: "unauthorized" }, { status: 401 });
  return runCron(req, "brief", async () => {
    if (!telegramConfigured()) return { status: 503, body: { ok: false, error: "Telegram não configurado" } };
    const brief = await buildBrief();
    if (!brief) return { body: { ok: true, skipped: true, reason: "nothing_actionable" } };
    const r = await sendTelegram(brief);
    return { status: r.ok ? 200 : 502, body: r };
  });
}
