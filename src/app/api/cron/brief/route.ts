import { tokenMatches } from "@/lib/auth";
import { buildBrief } from "@/server/brief";
import { sendTelegram, telegramConfigured } from "@/server/telegram";

export const maxDuration = 60;

/** Disparado pelo agendador da Vercel (vercel.json → crons) com Authorization: Bearer CRON_SECRET. */
export async function GET(req: Request) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!tokenMatches(bearer, "CRON_SECRET")) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!telegramConfigured()) return Response.json({ ok: false, error: "Telegram não configurado" }, { status: 503 });
  const brief = await buildBrief();
  if (!brief) return Response.json({ ok: true, skipped: true, reason: "nothing_actionable" });
  const r = await sendTelegram(brief);
  return Response.json(r, { status: r.ok ? 200 : 502 });
}
