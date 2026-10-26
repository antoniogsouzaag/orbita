import { tokenMatches } from "@/lib/auth";
import { aiEnabled, consolidateConversation } from "@/server/ai";
import { conversationsToConsolidate, expireConversations, markConsolidated } from "@/server/orbe-conversations";

export const maxDuration = 300;

/**
 * Rotina diária da ORBE (vercel.json → crons, Bearer CRON_SECRET):
 * 1. consolida na memória as conversas que mudaram desde a última passada;
 * 2. apaga as que expiraram, somente se já consolidadas.
 * Falha numa conversa não marca como consolidada: ela volta na próxima rodada e não é apagada.
 */
export async function GET(req: Request) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!tokenMatches(bearer, "CRON_SECRET")) return Response.json({ error: "unauthorized" }, { status: 401 });
  const results: { id: string; ok: boolean; changed?: number }[] = [];
  if (aiEnabled()) {
    const deadline = Date.now() + 240_000;
    for (const conv of await conversationsToConsolidate(20)) {
      if (Date.now() > deadline) break;
      const startedAt = new Date();
      try {
        const r = await consolidateConversation(conv);
        await markConsolidated(conv.id, startedAt);
        results.push({ id: conv.id, ok: true, changed: r.changed });
      } catch {
        results.push({ id: conv.id, ok: false });
      }
    }
  }
  const expired = await expireConversations();
  return Response.json({ ok: true, consolidated: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, memoryChanges: results.reduce((n, r) => n + (r.changed ?? 0), 0), expired });
}
