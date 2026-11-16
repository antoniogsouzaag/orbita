import { tokenMatches } from "@/lib/auth";
import { runCron } from "@/server/cron-runs";
import { cleanupSocialMedia } from "@/server/social-media";

export const maxDuration = 60;

/** Limpeza diária das mídias de redes (agendador interno, Bearer CRON_SECRET). Regras em MEDIA_RETENTION. `?simular=1` só relata o que sairia. */
export async function GET(req: Request) {
  if (!tokenMatches(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), "CRON_SECRET")) return Response.json({ error: "unauthorized" }, { status: 401 });
  // Simulação não conta como execução da rotina (não registra nem reserva o dia).
  if (new URL(req.url).searchParams.get("simular") === "1") return Response.json({ ok: true, ...(await cleanupSocialMedia(new Date(), { simular: true })) });
  return runCron(req, "midia", async () => ({ body: { ok: true, ...(await cleanupSocialMedia()) } }));
}
