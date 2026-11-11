/**
 * Agendador interno das rotinas diárias. No servidor próprio nada externo chama /api/cron/*:
 * a cada minuto este laço confere o relógio (sem tocar no banco) e chama a rota que entrou na
 * janela. A rota registra o desfecho e recusa repetir o que já terminou bem hoje, então um
 * reinício no meio da janela não duplica o bom dia.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { dueCrons, internalCronEnabled } = await import("./lib/internal-cron");
  if (!internalCronEnabled(process.env)) return;
  const g = globalThis as unknown as { __orbitaCron?: boolean };
  if (g.__orbitaCron) return;
  g.__orbitaCron = true;
  const base = process.env.ORBITA_INTERNAL_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`;
  const done = new Set<string>();
  const running = new Set<string>();
  const attempts = new Map<string, number>();
  const run = async (job: { path: string; key: string }) => {
    running.add(job.key);
    attempts.set(job.key, (attempts.get(job.key) ?? 0) + 1);
    try {
      const res = await fetch(`${base}${job.path}?agendado=1`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` }, signal: AbortSignal.timeout(310_000) });
      console.log(`[cron] ${job.path} → ${res.status}`);
      // 4xx é configuração (segredo, Telegram ausente): repetir não resolve.
      if (res.status < 500 || (attempts.get(job.key) ?? 0) >= 3) done.add(job.key);
    } catch (e) {
      const timedOut = e instanceof Error && e.name === "TimeoutError";
      console.error(`[cron] ${job.path} ${timedOut ? "passou do tempo" : "não respondeu"}`);
      // Tempo esgotado: a rota pode ainda estar trabalhando; não dispara de novo.
      if (timedOut || (attempts.get(job.key) ?? 0) >= 3) done.add(job.key);
    } finally {
      running.delete(job.key);
    }
  };
  const tick = () => {
    const now = new Date();
    for (const job of dueCrons(now, done)) if (!running.has(job.key)) void run(job);
    const today = now.toISOString().slice(0, 10);
    for (const key of done) if (!key.endsWith(today)) { done.delete(key); attempts.delete(key); }
  };
  setInterval(tick, 60_000).unref?.();
}
