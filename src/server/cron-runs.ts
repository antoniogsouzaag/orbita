import "server-only";
import { and, eq, like, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { tokenMatches } from "@/lib/auth";
import { INTERNAL_CRONS, scheduledAt, type CronJob } from "@/lib/internal-cron";

/** Última execução de uma rotina. Guarda só o desfecho: nunca a resposta nem o erro. */
export type CronRun = { at: string; ok: boolean; status: number; ms: number; lastOkAt: string | null };

const PREFIX = "cron-run:";
const JOBS = new Set<string>(INTERNAL_CRONS.map((c) => c.job));

export async function cronRuns(): Promise<Partial<Record<CronJob, CronRun>>> {
  const db = await getDb();
  const rows = await db.select().from(settings).where(like(settings.key, `${PREFIX}%`));
  const runs: Partial<Record<CronJob, CronRun>> = {};
  for (const row of rows) {
    const job = row.key.slice(PREFIX.length);
    const value = row.value as Partial<CronRun> | null;
    if (JOBS.has(job) && value && typeof value.at === "string") {
      runs[job as CronJob] = { at: value.at, ok: value.ok === true, status: Number(value.status) || 0, ms: Number(value.ms) || 0, lastOkAt: typeof value.lastOkAt === "string" ? value.lastOkAt : null };
    }
  }
  return runs;
}

export async function recordCronRun(job: CronJob, run: Omit<CronRun, "lastOkAt">, previous?: CronRun) {
  const db = await getDb();
  const value: CronRun = { ...run, lastOkAt: run.ok ? run.at : previous?.lastOkAt ?? null };
  await db.insert(settings).values({ key: `${PREFIX}${job}`, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}

// Retry is explicit: a timeout or an unknown provider result must not repeat a side effect.
type CronOutcome = { status?: number; body: Record<string, unknown>; retryable?: boolean };

/**
 * Entrada única das rotas /api/cron/*: confere o CRON_SECRET, executa e registra o desfecho.
 * Com `?agendado=1` (agendador interno) não repete a rotina que já terminou bem depois do
 * horário de hoje, o que cobre reinício do servidor dentro da janela. Chamada manual sempre executa.
 */
export async function runCron(req: Request, job: CronJob, work: () => Promise<CronOutcome>): Promise<Response> {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!tokenMatches(bearer, "CRON_SECRET")) return Response.json({ error: "unauthorized" }, { status: 401 });
  const startedAt = new Date();
  let previous: CronRun | undefined;
  try { previous = (await cronRuns())[job]; } catch {
    return Response.json({ ok: false, error: "Não foi possível reservar a rotina" }, { status: 503 });
  }
  const scheduled = new URL(req.url).searchParams.get("agendado") === "1";
  if (scheduled && previous?.lastOkAt && new Date(previous.lastOkAt) >= scheduledAt(job, startedAt)) {
    return Response.json({ ok: true, skipped: true, reason: "already_ran" });
  }
  const db = await getDb();
  const key = `cron-claim:${job}@${startedAt.toISOString().slice(0, 10)}`;
  const claimId = randomUUID();
  if (scheduled) {
    try {
      const claim = { state: "running", claimId, at: startedAt.toISOString() };
      const rows = await db.insert(settings).values({ key, value: claim }).onConflictDoUpdate({
        target: settings.key, set: { value: claim }, where: sql`${settings.value}->>'state' = 'retryable'`,
      }).returning({ key: settings.key });
      if (!rows.length) return Response.json({ ok: true, skipped: true, reason: "already_claimed", review: "Confira a última execução antes de tentar manualmente" });
    } catch { return Response.json({ ok: false, error: "Não foi possível reservar a rotina" }, { status: 503 }); }
  }
  let outcome: CronOutcome;
  try {
    outcome = await work();
  } catch (e) {
    outcome = { status: 502, body: { ok: false, error: e instanceof Error ? e.message : "falha" } };
  }
  const status = outcome.status ?? 200;
  try {
    await recordCronRun(job, { at: startedAt.toISOString(), ok: status < 400, status, ms: Date.now() - startedAt.getTime() }, previous);
    if (scheduled) await db.update(settings).set({ value: {
      state: status < 400 ? "done" : outcome.retryable ? "retryable" : "unknown", claimId, at: startedAt.toISOString(), status,
    } }).where(and(eq(settings.key, key), sql`${settings.value}->>'claimId' = ${claimId}`));
  } catch {
    // The persistent reservation remains. Never repeat work just because its receipt could not be saved.
    return Response.json({ ok: false, error: "Resultado exige conferência: recibo não persistido" }, { status: 503 });
  }
  return Response.json(outcome.body, { status });
}
