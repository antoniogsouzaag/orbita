import { tokenMatches } from "@/lib/auth";
import { runCron } from "@/server/cron-runs";
import { retryPendingSchedules, syncScheduledPosts } from "@/server/social-publish";

export const maxDuration = 60;

/**
 * Fechamento diário das redes (agendador interno, Bearer CRON_SECRET): agendados publicados viram Publicado com link
 * e media_id, post que saiu direto pelo Postiz é vinculado e o agendamento que parou no limite do Postiz é retomado.
 */
export async function GET(req: Request) {
  if (!tokenMatches(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), "CRON_SECRET")) return Response.json({ error: "unauthorized" }, { status: 401 });
  return runCron(req, "redes", async () => {
    const sync = await syncScheduledPosts();
    // A retomada não derruba o fechamento: falha fica no relatório.
    const retomada = await retryPendingSchedules().catch((e: unknown) => ({ erro: e instanceof Error ? e.message : "falhou" }));
    return { body: { ok: true, ...sync, retomada } };
  });
}
