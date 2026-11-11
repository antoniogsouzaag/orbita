import "server-only";
import { like } from "drizzle-orm";
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

type CronOutcome = { status?: number; body: Record<string, unknown> };

/**
 * Entrada única das rotas /api/cron/*: confere o CRON_SECRET, executa e registra o desfecho.
 * Com `?agendado=1` (agendador interno) não repete a rotina que já terminou bem depois do
 * horário de hoje, o que cobre reinício do servidor dentro da janela. Chamada manual sempre executa.
 */
export async function runCron(req: Request, job: CronJob, work: () => Promise<CronOutcome>): Promise<Response> {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!tokenMatches(bearer, "CRON_SECRET")) return Response.json({ error: "unauthorized" }, { status: 401 });
  const startedAt = new Date();
  const previous = (await cronRuns().catch(() => ({} as Partial<Record<CronJob, CronRun>>)))[job];
  if (new URL(req.url).searchParams.get("agendado") === "1" && previous?.lastOkAt && new Date(previous.lastOkAt) >= scheduledAt(job, startedAt)) {
    return Response.json({ ok: true, skipped: true, reason: "already_ran" });
  }
  let outcome: CronOutcome;
  try {
    outcome = await work();
  } catch (e) {
    outcome = { status: 502, body: { ok: false, error: e instanceof Error ? e.message : "falha" } };
  }
  const status = outcome.status ?? 200;
  await recordCronRun(job, { at: startedAt.toISOString(), ok: status < 400, status, ms: Date.now() - startedAt.getTime() }, previous).catch(() => undefined);
  return Response.json(outcome.body, { status });
}
