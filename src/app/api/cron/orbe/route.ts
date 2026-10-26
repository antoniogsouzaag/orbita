import { tokenMatches } from "@/lib/auth";
import { aiEnabled, consolidateConversation, consolidationEnabled } from "@/server/ai";
import { conversationsToConsolidate, expireConversations, markConsolidated } from "@/server/orbe-conversations";

export const maxDuration = 300;
/** Teto de conversas revisadas por noite. */
const PER_RUN = 20;

/**
 * Rotina diária da ORBE (vercel.json → crons, Bearer CRON_SECRET):
 * 1. consolida na memória as conversas que mudaram desde a última passada
 *    (curtas não chamam IA; o Jev pode filtrar antes do modelo que escreve);
 * 2. apaga as que expiraram, somente se já consolidadas.
 * Falha numa conversa não marca como consolidada: ela volta na próxima rodada e não é apagada.
 * ORBE_CONSOLIDATION_ENABLED=false pausa tudo, inclusive a expiração.
 */
export async function GET(req: Request) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!tokenMatches(bearer, "CRON_SECRET")) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!consolidationEnabled()) return Response.json({ ok: true, paused: true });
  const results: { ok: boolean; changed?: number; skipped?: string }[] = [];
  if (aiEnabled()) {
    const deadline = Date.now() + 240_000;
    for (const conv of await conversationsToConsolidate(PER_RUN)) {
      if (Date.now() > deadline) break;
      const startedAt = new Date();
      try {
        const r = await consolidateConversation(conv);
        await markConsolidated(conv.id, startedAt);
        results.push({ ok: true, changed: r.changed, skipped: r.skipped });
      } catch {
        results.push({ ok: false });
      }
    }
  }
  const expired = await expireConversations();
  const ok = results.filter((r) => r.ok);
  return Response.json({
    ok: true,
    consolidated: ok.length,
    skippedWithoutModel: ok.filter((r) => r.skipped).length,
    failed: results.length - ok.length,
    memoryChanges: ok.reduce((n, r) => n + (r.changed ?? 0), 0),
    expired,
  });
}
