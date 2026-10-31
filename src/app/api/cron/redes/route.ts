import { tokenMatches } from "@/lib/auth";
import { syncScheduledPosts } from "@/server/social-publish";

export const maxDuration = 60;

/** Fechamento diário das redes (vercel.json → crons, Bearer CRON_SECRET): agendados publicados viram Publicado com link e media_id. */
export async function GET(req: Request) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!tokenMatches(bearer, "CRON_SECRET")) return Response.json({ error: "unauthorized" }, { status: 401 });
  try { return Response.json({ ok: true, ...(await syncScheduledPosts()) }); }
  catch (e) { return Response.json({ ok: false, error: e instanceof Error ? e.message : "falha" }, { status: 502 }); }
}
