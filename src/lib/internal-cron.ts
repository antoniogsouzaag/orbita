/**
 * Rotinas diárias da Órbita (horários em UTC). No servidor próprio nada externo chama as rotas:
 * o agendador de `src/instrumentation.ts` dispara cada uma no horário e recupera a que perdeu
 * a janela (deploy ou reinício na hora marcada).
 */
export const INTERNAL_CRONS = [
  { job: "redes", path: "/api/cron/redes", hour: 3, minute: 15, label: "Fechamento das redes" },
  { job: "orbe", path: "/api/cron/orbe", hour: 6, minute: 0, label: "Memória da ORBE" },
  { job: "midia", path: "/api/cron/midia", hour: 7, minute: 30, label: "Limpeza de mídias" },
  { job: "brief", path: "/api/cron/brief", hour: 10, minute: 0, label: "Bom dia" },
] as const;

export type CronJob = (typeof INTERNAL_CRONS)[number]["job"];

/** Depois do horário, a rotina ainda pode rodar por este tempo. */
export const CATCH_UP_MINUTES = 180;

/** Horário marcado da rotina no dia UTC de `now`. */
export function scheduledAt(job: CronJob, now: Date): Date {
  const cron = INTERNAL_CRONS.find((c) => c.job === job)!;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), cron.hour, cron.minute));
}

/** Rotinas dentro da janela de hoje que ainda não foram encerradas (chave = rotina + dia UTC). */
export function dueCrons(now: Date, done: Set<string>) {
  const day = now.toISOString().slice(0, 10);
  return INTERNAL_CRONS.filter((c) => {
    const late = now.getTime() - scheduledAt(c.job, now).getTime();
    return late >= 0 && late < CATCH_UP_MINUTES * 60_000 && !done.has(`${c.job}@${day}`);
  }).map((c) => ({ job: c.job, path: c.path, key: `${c.job}@${day}` }));
}

/**
 * `ORBITA_INTERNAL_CRON=1` liga e `0` desliga. Sem a variável, liga em produção fora da Vercel
 * quando há `CRON_SECRET`: no servidor próprio não existe outro agendador.
 */
export function internalCronEnabled(env: Record<string, string | undefined>): boolean {
  if (env.ORBITA_INTERNAL_CRON === "1") return true;
  if (env.ORBITA_INTERNAL_CRON === "0") return false;
  return env.NODE_ENV === "production" && !env.VERCEL && Boolean(env.CRON_SECRET?.trim());
}

/** Depois deste tempo sem terminar bem, a rotina diária está atrasada. */
export const CRON_LATE_HOURS = 26;

type RunLike = { at: string; ok: boolean; status: number; lastOkAt: string | null };

/** Rotinas sem execução bem-sucedida recente, com o motivo em uma frase. */
export function lateCrons(runs: Partial<Record<CronJob, RunLike>>, now: Date): string[] {
  return INTERNAL_CRONS.flatMap((cron) => {
    const run = runs[cron.job];
    if (run?.lastOkAt && now.getTime() - new Date(run.lastOkAt).getTime() <= CRON_LATE_HOURS * 3_600_000) return [];
    return [`${cron.label}: ${!run ? "sem execução registrada" : run.ok ? `última em ${run.at}` : `falhou em ${run.at} (HTTP ${run.status})`}`];
  });
}
