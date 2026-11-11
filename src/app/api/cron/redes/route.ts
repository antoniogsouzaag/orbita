import { tokenMatches } from "@/lib/auth";
import { runCron } from "@/server/cron-runs";
import { syncScheduledPosts } from "@/server/social-publish";

export const maxDuration = 60;

/** Fechamento diário das redes (agendador interno, Bearer CRON_SECRET): agendados publicados viram Publicado com link e media_id. */
export async function GET(req: Request) {
  if (!tokenMatches(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), "CRON_SECRET")) return Response.json({ error: "unauthorized" }, { status: 401 });
  return runCron(req, "redes", async () => ({ body: { ok: true, ...(await syncScheduledPosts()) } }));
}
