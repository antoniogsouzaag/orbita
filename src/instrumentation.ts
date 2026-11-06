/**
 * Agendador interno para hospedagem própria (VPS): a Vercel chamava as rotas de cron pelo vercel.json;
 * fora dela nada chama. Liga só com ORBITA_INTERNAL_CRON=1 para não duplicar execução na Vercel.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.ORBITA_INTERNAL_CRON !== "1") return;
  const g = globalThis as unknown as { __orbitaCron?: boolean };
  if (g.__orbitaCron) return;
  g.__orbitaCron = true;
  const { dueCrons } = await import("./lib/internal-cron");
  const base = process.env.ORBITA_INTERNAL_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`;
  const ran = new Set<string>();
  const tick = async () => {
    for (const job of dueCrons(new Date(), ran)) {
      ran.add(job.key);
      try {
        const res = await fetch(`${base}${job.path}`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` }, signal: AbortSignal.timeout(120_000) });
        console.log(`[cron] ${job.path} → ${res.status}`);
      } catch (e) { console.error(`[cron] ${job.path} falhou`, e); }
    }
    const today = new Date().toISOString().slice(0, 10);
    for (const k of ran) if (!k.endsWith(today)) ran.delete(k);
  };
  setInterval(() => void tick(), 60_000).unref?.();
}
