import "server-only";
import { and, desc, eq, gte, isNotNull, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { agentActivity, opsDomains, opsEvents, opsHeartbeats, opsStatus } from "@/db/schema";
import { getRawSetting, setRawSetting } from "./security-store";
import { monitorTargets } from "./ops";

/* ───────────── Limpeza automática (sem acumular histórico velho) ───────────── */

const DAY = 86_400_000;

/** Apaga o que perdeu valor. Roda no máximo uma vez por dia, embutida na ingestão do n8n. */
export async function pruneOld(force = false) {
  const last = Number(((await getRawSetting("prune")) as { at?: number } | undefined)?.at ?? 0);
  if (!force && Date.now() - last < DAY) return null;
  await setRawSetting("prune", { at: Date.now() });
  const db = await getDb();
  const ago = (d: number) => new Date(Date.now() - d * DAY);
  const r = {
    atividade: (await db.delete(agentActivity).where(lt(agentActivity.createdAt, ago(30))).returning({ id: agentActivity.id })).length,
    eventos: (
      await db
        .delete(opsEvents)
        .where(or(and(isNotNull(opsEvents.resolvedAt), lt(opsEvents.createdAt, ago(90))), and(eq(opsEvents.kind, "workflow_error"), lt(opsEvents.createdAt, ago(30))), and(eq(opsEvents.severity, "info"), lt(opsEvents.createdAt, ago(30)))))
        .returning({ id: opsEvents.id })
    ).length,
    enderecos: (await db.delete(opsStatus).where(lt(opsStatus.checkedAt, ago(14))).returning({ url: opsStatus.url })).length,
    monitores: (await db.delete(opsHeartbeats).where(lt(opsHeartbeats.lastSeen, ago(30))).returning({ s: opsHeartbeats.source })).length,
    dominios: (await db.delete(opsDomains).where(lt(opsDomains.checkedAt, ago(30))).returning({ d: opsDomains.domain })).length,
  };
  return r;
}

/* ───────────── Ingestão (n8n → Órbita) ───────────── */

const str = z.string().trim().max(2000);
const link = z
  .object({
    url: z.string().url().max(2000),
    nome: str.nullish(),
    name: str.nullish(),
    grupo: str.nullish(),
    group: str.nullish(),
    ok: z.boolean().nullish(),
    status: z.coerce.number().int().min(0).max(999).nullish(),
    statusCode: z.coerce.number().int().min(0).max(999).nullish(),
    erro: str.nullish(),
    error: str.nullish(),
    ms: z.coerce.number().int().min(0).max(600_000).nullish(),
  })
  .transform((l) => {
    const status = l.status ?? l.statusCode ?? 0;
    return { url: l.url, name: l.nome ?? l.name ?? l.url, group: l.grupo ?? l.group ?? null, ok: l.ok ?? (status >= 200 && status < 400), status, error: l.erro ?? l.error ?? null, ms: l.ms ?? null };
  });

const domain = z
  .object({
    dominio: str.nullish(),
    domain: str.nullish(),
    depende: str.nullish(),
    depends: str.nullish(),
    expiracao: str.nullish(),
    dataExpiracao: str.nullish(),
    expiresAt: str.nullish(),
    erro: str.nullish(),
    detalhe: str.nullish(),
    error: str.nullish(),
  })
  .transform((d) => ({ domain: (d.dominio ?? d.domain ?? "").toLowerCase(), depends: d.depende ?? d.depends ?? null, expiresAt: d.expiracao ?? d.dataExpiracao ?? d.expiresAt ?? null, error: d.erro ?? d.detalhe ?? d.error ?? null }))
  .refine((d) => d.domain.length > 0, "domínio vazio");

export const IngestSchema = z.object({
  source: z.string().trim().min(1).max(80),
  label: z.string().trim().max(120).optional(),
  everyMinutes: z.coerce.number().int().min(1).max(60 * 24 * 31).optional(),
  links: z.array(link).max(500).optional(),
  domains: z.array(domain).max(500).optional(),
  workflowError: z
    .object({ workflow: str, workflowId: str.nullish(), node: str.nullish(), message: str, executionUrl: z.string().url().max(2000).nullish() })
    .optional(),
  events: z.array(z.object({ kind: z.string().max(40), severity: z.enum(["info", "warning", "critical"]).default("info"), subject: str, detail: z.record(z.string(), z.unknown()).optional() })).max(50).optional(),
});
export type IngestPayload = z.infer<typeof IngestSchema>;

/** Registra resultados, detecta mudanças de estado e atualiza a batida do monitor. */
export async function ingest(p: IngestPayload) {
  const db = await getDb();
  const now = new Date();
  const counters = { links: 0, domains: 0, events: 0 };

  // Só execuções de monitor (com links ou domínios) contam como batida; alertas avulsos de falha não,
  // senão a fonte "alerta de falhas" apareceria como monitor em silêncio.
  if (p.links || p.domains) {
    await db
      .insert(opsHeartbeats)
      .values({ source: p.source, label: p.label ?? p.source, lastSeen: now, everyMinutes: p.everyMinutes ?? 15 })
      .onConflictDoUpdate({ target: opsHeartbeats.source, set: { lastSeen: now, ...(p.label ? { label: p.label } : {}), ...(p.everyMinutes ? { everyMinutes: p.everyMinutes } : {}) } });
  }

  for (const l of p.links ?? []) {
    const [prev] = await db.select().from(opsStatus).where(eq(opsStatus.url, l.url));
    const fails = l.ok ? 0 : (prev?.fails ?? 0) + 1;
    // queda só é confirmada com 2 falhas seguidas (mesmo critério do "ping my links");
    // uma falha isolada aparece como "instável" (ok = true, fails = 1)
    const ok = fails < 2;
    const changed = !prev || prev.ok !== ok;
    const row = {
      url: l.url,
      name: l.name,
      group: l.group,
      ok,
      statusCode: l.status || null,
      error: l.ok ? null : l.error,
      latencyMs: l.ms,
      fails,
      source: p.source,
      checkedAt: now,
      changedAt: changed ? now : prev.changedAt,
    };
    await db.insert(opsStatus).values(row).onConflictDoUpdate({ target: opsStatus.url, set: row });
    if (prev?.ok !== false && !ok) {
      await db.insert(opsEvents).values({ kind: "site_down", severity: "critical", source: p.source, subject: l.name, detail: { url: l.url, status: l.status, error: l.error, group: l.group } });
      counters.events++;
    } else if (prev && !prev.ok && ok) {
      await db.update(opsEvents).set({ resolvedAt: now }).where(and(eq(opsEvents.kind, "site_down"), isNull(opsEvents.resolvedAt), eq(opsEvents.subject, prev.name)));
      await db.insert(opsEvents).values({ kind: "site_up", severity: "info", source: p.source, subject: l.name, detail: { url: l.url, downSince: prev.changedAt.toISOString() } });
      counters.events++;
    }
    counters.links++;
  }

  for (const d of p.domains ?? []) {
    const expires = d.expiresAt ? new Date(d.expiresAt) : null;
    const row = { domain: d.domain, depends: d.depends, expiresAt: expires && !Number.isNaN(expires.getTime()) ? expires : null, error: d.error, source: p.source, checkedAt: now };
    await db.insert(opsDomains).values(row).onConflictDoUpdate({ target: opsDomains.domain, set: row });
    counters.domains++;
  }

  if (p.workflowError) {
    const e = p.workflowError;
    await db.insert(opsEvents).values({ kind: "workflow_error", severity: "warning", source: p.source, subject: e.workflow, detail: { node: e.node, message: e.message, executionUrl: e.executionUrl, workflowId: e.workflowId } });
    counters.events++;
  }
  for (const e of p.events ?? []) {
    await db.insert(opsEvents).values({ kind: e.kind, severity: e.severity, source: p.source, subject: e.subject, detail: e.detail ?? {} });
    counters.events++;
  }
  await pruneOld().catch((e) => console.error("[prune]", e));
  return counters;
}

/* ───────────── Leitura para o painel ───────────── */

export type MonitorHealth = { source: string; label: string; lastSeen: Date; everyMinutes: number; silent: boolean; minutesAgo: number };

export async function liveOps() {
  const db = await getDb();
  const since = new Date(Date.now() - 14 * 86_400_000);
  const [status, events, beats, domains] = await Promise.all([
    db.select().from(opsStatus),
    db.select().from(opsEvents).where(gte(opsEvents.createdAt, since)).orderBy(desc(opsEvents.createdAt)).limit(80),
    db.select().from(opsHeartbeats),
    db.select().from(opsDomains),
  ]);
  const now = Date.now();
  const monitors: MonitorHealth[] = beats.map((b) => {
    const minutesAgo = Math.round((now - b.lastSeen.getTime()) / 60_000);
    return { source: b.source, label: b.label ?? b.source, lastSeen: b.lastSeen, everyMinutes: b.everyMinutes, minutesAgo, silent: minutesAgo > b.everyMinutes * 2.5 + 2 };
  });
  return { generatedAt: now, status, events, monitors, domains: domains.sort((a, b) => (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity)) };
}

const norm = (u: string) => u.replace(/\/+$/, "").toLowerCase();

/** Compara a lista canônica do vault com o que os monitores realmente verificam. */
export async function coherence() {
  const [targets, { status }] = await Promise.all([monitorTargets().catch(() => null), liveOps()]);
  if (!targets) return null;
  const fresh = status.filter((s) => Date.now() - s.checkedAt.getTime() < 6 * 3_600_000);
  const vault = new Map(targets.map((t) => [norm(t.url), t]));
  const monitored = new Map(fresh.map((s) => [norm(s.url), s]));
  return {
    vaultCount: vault.size,
    monitoredCount: monitored.size,
    notMonitored: [...vault.entries()].filter(([u]) => !monitored.has(u)).map(([, t]) => t),
    notInVault: [...monitored.entries()].filter(([u]) => !vault.has(u)).map(([, s]) => ({ url: s.url, name: s.name, source: s.source })),
  };
}
