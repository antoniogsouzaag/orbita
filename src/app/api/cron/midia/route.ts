import { tokenMatches } from "@/lib/auth";
import { cleanupSocialMedia } from "@/server/social-media";

export const maxDuration = 60;

/** Limpeza diária das mídias de redes (vercel.json → crons, Bearer CRON_SECRET). Regras em MEDIA_RETENTION. */
export async function GET(req: Request) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!tokenMatches(bearer, "CRON_SECRET")) return Response.json({ error: "unauthorized" }, { status: 401 });
  try { return Response.json({ ok: true, ...(await cleanupSocialMedia()) }); }
  catch (e) { return Response.json({ ok: false, error: e instanceof Error ? e.message : "falha" }, { status: 502 }); }
}
