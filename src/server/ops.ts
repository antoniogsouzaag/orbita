import "server-only";
import { z } from "zod";
import { firstUrl, firstWikiTarget, parseTables, plainText, type MdTable } from "@/lib/md-tables";
import { normalize } from "@/lib/text";
import { getVaultIndexSafe, type VaultNote } from "@/server/vault";

/* ───────────── Leitura do vault ───────────── */

async function noteByName(name: string): Promise<VaultNote | null> {
  const idx = await getVaultIndexSafe();
  if (!idx) return null;
  const path = idx.resolve(name);
  return path ? idx.notes.get(path) ?? null : null;
}

function col(t: MdTable, ...names: string[]): number {
  const n = names.map(normalize);
  return t.headers.findIndex((h) => n.some((x) => normalize(h).startsWith(x)));
}

export type MonitorTarget = { url: string; name: string; group: string; priority: string };

export async function monitorTargets(): Promise<MonitorTarget[] | null> {
  const note = await noteByName("Monitoramento de Disponibilidade");
  if (!note) return null;
  const out: MonitorTarget[] = [];
  for (const t of parseTables(note.body)) {
    const ci = col(t, "endereco", "url");
    if (ci < 0) continue;
    const di = t.headers.findIndex((_, i) => i !== ci);
    const heading = t.headings.at(-1) ?? "";
    const priority = /^P\d/.exec(heading)?.[0] ?? "—";
    const group = heading.split(/\s*\(/)[0];
    for (const r of t.rows) {
      const url = firstUrl(r[ci] ?? "");
      if (url) out.push({ url, name: plainText(r[di] ?? url), group, priority });
    }
  }
  return out;
}

export type Agent = { name: string; emoji: string; area: string; role: string; status: string; path: string | null };

export async function agents(): Promise<Agent[]> {
  const note = await noteByName("Registro de Agentes");
  if (!note) return [];
  const idx = (await getVaultIndexSafe())!; // já carregado por noteByName
  const t = parseTables(note.body).find((x) => col(x, "agente") >= 0);
  if (!t) return [];
  const [a, ar, f, s] = [col(t, "agente"), col(t, "area"), col(t, "funcao"), col(t, "status")];
  return t.rows.map((r) => {
    const target = firstWikiTarget(r[a] ?? "");
    const text = plainText(r[a] ?? "");
    const emoji = /\p{Extended_Pictographic}/u.exec(text)?.[0] ?? "🤖";
    return {
      name: text.replace(/\p{Extended_Pictographic}|️/gu, "").replace(/^Agente\s*-\s*/, "").trim(),
      emoji,
      area: plainText(r[ar] ?? ""),
      role: plainText(r[f] ?? ""),
      status: plainText(r[s] ?? ""),
      path: target ? idx.resolve(target) : null,
    };
  });
}

export type Vps = { name: string; path: string; provider: string; identifier: string; panel: string; summary: string; capacity: { k: string; v: string }[] };

export async function vpsList(): Promise<Vps[]> {
  const idx = await getVaultIndexSafe();
  if (!idx) return [];
  return [...idx.notes.values()]
    .filter((n) => n.frontmatter.type === "vps")
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((n) => {
      const cap = parseTables(n.body).find((t) => t.headings.some((h) => /capacidade/i.test(h)));
      const finalidade = /##\s*Finalidade\s*\n+([^\n#]+)/.exec(n.body)?.[1] ?? /Finalidade:\s*([^\n]+)/.exec(n.body)?.[1] ?? "";
      return {
        name: n.title,
        path: n.path,
        provider: String(n.frontmatter.provider ?? ""),
        identifier: String(n.frontmatter.identifier ?? ""),
        panel: String(n.frontmatter.panel ?? ""),
        summary: plainText(finalidade.replace(/^-\s*/, "")),
        capacity: cap ? cap.rows.map((r) => ({ k: plainText(r[0] ?? ""), v: plainText(r[1] ?? "") })) : [],
      };
    });
}

export type AppRepo = { repo: string; branch: string; check: string; gate: string; page: string | null; pagePath: string | null };

export async function appRegistry(): Promise<AppRepo[]> {
  const note = await noteByName("Registro de Aplicações");
  if (!note) return [];
  const idx = (await getVaultIndexSafe())!; // já carregado por noteByName
  const t = parseTables(note.body).find((x) => col(x, "repositorio") >= 0 && col(x, "portao") >= 0);
  if (!t) return [];
  const [r0, b, c, g, f] = [col(t, "repositorio"), col(t, "branch"), col(t, "comando"), col(t, "portao"), col(t, "ficha")];
  return t.rows.map((r) => {
    const target = firstWikiTarget(r[f] ?? "");
    return { repo: plainText(r[r0] ?? ""), branch: plainText(r[b] ?? ""), check: plainText(r[c] ?? ""), gate: plainText(r[g] ?? ""), page: target ? plainText(r[f] ?? "") : null, pagePath: target ? idx.resolve(target) : null };
  });
}

export type DocumentedAutomation = { name: string; id: string | null; ids: string[]; description: string; schedule: string; where: string };

async function readDocumentedAutomations(): Promise<DocumentedAutomation[] | null> {
  const note = await noteByName("Automações Ativas");
  if (!note) return null;
  const out: DocumentedAutomation[] = [];
  let recognized = false;
  for (const t of parseTables(note.body)) {
    const n = col(t, "automacao", "tarefa", "rotina");
    if (n < 0) continue;
    recognized = true;
    const [i, fn, ex, onde] = [col(t, "id"), col(t, "funcao"), col(t, "execucao"), col(t, "onde")];
    const where = t.headings.find((h) => /n8n|claude|codex|aplica|clientes/i.test(h)) ?? t.headings.at(-1) ?? "";
    for (const r of t.rows) {
      const ids = i >= 0 ? [...new Set((r[i] ?? "").replace(/`/g, "").split(/[,;\n]|<br\s*\/?>/i).map(id => id.trim()).filter(id => /^[a-zA-Z0-9_-]+$/.test(id)))] : [];
      out.push({
        name: plainText(r[n] ?? ""),
        id: ids[0] ?? null,
        ids,
        description: fn >= 0 ? plainText(r[fn] ?? "") : "",
        schedule: ex >= 0 ? plainText(r[ex] ?? "") : "",
        where: onde >= 0 ? plainText(r[onde] ?? "") : plainText(where),
      });
    }
  }
  return recognized ? out : null;
}

export async function documentedAutomations(): Promise<DocumentedAutomation[]> {
  return (await readDocumentedAutomations()) ?? [];
}

/* ───────────── Checagem de disponibilidade ───────────── */

export type CheckResult = MonitorTarget & { ok: boolean; status: number; ms: number; error?: string; checkedAt: string };

const cache = new Map<string, CheckResult>();
const TTL = 60_000;

async function checkOnce(url: string): Promise<{ status: number; ms: number; error?: string }> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { method: "GET", redirect: "manual", cache: "no-store", headers: { "user-agent": "Orbita-Monitor/1.0" }, signal: AbortSignal.timeout(12_000) });
    res.body?.cancel().catch(() => {});
    return { status: res.status, ms: Date.now() - t0 };
  } catch (e) {
    const raw = e instanceof Error ? (e.name === "TimeoutError" ? "timeout" : (e.cause as Error | undefined)?.message ?? e.message) : String(e);
    const err = /ENOTFOUND|EAI_AGAIN/.test(raw) ? "DNS" : /ECONNREFUSED/.test(raw) ? "recusado" : /ECONNRESET|socket/i.test(raw) ? "conexão caiu" : /CERT|SSL|TLS/i.test(raw) ? "certificado" : raw === "timeout" ? "timeout" : "erro";
    return { status: 0, ms: Date.now() - t0, error: err };
  }
}

export async function checkTargets(targets: MonitorTarget[], force = false): Promise<CheckResult[]> {
  const now = Date.now();
  return Promise.all(
    targets.map(async (t) => {
      const hit = cache.get(t.url);
      if (!force && hit && now - Date.parse(hit.checkedAt) < TTL) return { ...hit, ...t };
      let r = await checkOnce(t.url);
      if (r.status === 0 || r.status >= 500) r = await checkOnce(t.url); // uma nova tentativa antes de acusar queda
      const res: CheckResult = { ...t, ...r, ok: r.status >= 200 && r.status < 400, checkedAt: new Date().toISOString() };
      cache.set(t.url, res);
      return res;
    }),
  );
}

/* ───────────── n8n ───────────── */

export type N8nInstance = { name: string; url: string; apiKey: string };
export type N8nWorkflow = { id: string; name: string; active: boolean; updatedAt: string; tags: string[]; instance: string; documented: DocumentedAutomation | null };
export type N8nExecution = { id: string; workflowId: string; workflowName: string; status: string; startedAt: string; stoppedAt: string | null; instance: string; url: string };

export function n8nInstances(): N8nInstance[] {
  try {
    const raw = JSON.parse(process.env.N8N_INSTANCES ?? "[]");
    return Array.isArray(raw) ? raw.filter((x) => x?.url && x?.apiKey).map((x) => ({ name: String(x.name ?? x.url), url: String(x.url).replace(/\/$/, ""), apiKey: String(x.apiKey) })) : [];
  } catch {
    return [];
  }
}

async function n8nGet<T>(inst: N8nInstance, path: string): Promise<T> {
  const res = await fetch(`${inst.url}/api/v1${path}`, { headers: { "X-N8N-API-KEY": inst.apiKey, accept: "application/json" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new N8nHttpError(res.status);
  return res.json() as Promise<T>;
}
class N8nHttpError extends Error {
  constructor(readonly status: number) { super(`HTTP ${status}`); }
}

const workflowPageSchema = z.object({
  data: z.array(z.object({
    id: z.string().min(1), name: z.string(), active: z.boolean(), updatedAt: z.iso.datetime({ offset: true }),
    tags: z.array(z.object({ name: z.string() })).optional(),
  })),
  nextCursor: z.string().min(1).nullish(),
});
const executionPageSchema = z.object({
  data: z.array(z.object({
    id: z.string().min(1), workflowId: z.string().min(1), status: z.string().optional(),
    startedAt: z.iso.datetime({ offset: true }), stoppedAt: z.iso.datetime({ offset: true }).nullable(),
  })),
  nextCursor: z.string().min(1).nullish(),
});

function n8nError(error: unknown) {
  return error instanceof N8nHttpError ? `Não foi possível consultar n8n (HTTP ${error.status}).` : "Não foi possível consultar n8n. Confira a conexão e tente novamente.";
}

/** IDs só têm significado dentro de um runtime; colisão não comprova documentação. */
function documentedWorkflow(docs: DocumentedAutomation[], inst: N8nInstance, id: string) {
  const candidates = docs.filter(doc => doc.ids.includes(id));
  const hostname = new URL(inst.url).hostname.toLowerCase();
  const runtime = /vps[\s-]*(\d+)/i.exec(inst.name)?.[1];
  return candidates.find(doc => {
    const where = doc.where.toLowerCase();
    if (!/n8n/i.test(where) && !/^vps[\s-]*\d+$/.test(where.trim())) return false;
    return where.includes(hostname) || normalize(where) === normalize(inst.name)
      || Boolean(runtime && /vps[\s-]*(\d+)/i.exec(where)?.[1] === runtime);
  }) ?? null;
}

export async function n8nOverview() {
  const instances = n8nInstances();
  const source = await readDocumentedAutomations().catch(() => null);
  const docs = source ?? [];
  const results = await Promise.all(instances.map(async (inst) => {
    const workflows: N8nWorkflow[] = [];
    const [inventory, executions] = await Promise.allSettled([
      (async () => {
        let cursor: string | undefined;
        const cursors = new Set<string>();
        const ids = new Set<string>();
        for (let page = 0; page < 10; page++) {
          const r = workflowPageSchema.parse(await n8nGet<unknown>(inst, `/workflows?limit=250${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`));
          for (const w of r.data) {
            if (ids.has(w.id)) continue;
            ids.add(w.id);
            workflows.push({ ...w, tags: (w.tags ?? []).map(t => t.name), instance: inst.name, documented: documentedWorkflow(docs, inst, w.id) });
          }
          if (!r.nextCursor) return false;
          if (page === 9 || cursors.has(r.nextCursor)) return true;
          cursors.add(r.nextCursor);
          cursor = r.nextCursor;
        }
        return true;
      })(),
      (async () => executionPageSchema.parse(await n8nGet<unknown>(inst, "/executions?status=error&limit=25")))(),
    ]);
    const names = new Map(workflows.map(w => [w.id, w.name]));
    const errors: N8nExecution[] = executions.status === "fulfilled" ? [...new Map(executions.value.data.map(e => [e.id, e])).values()].map(e => ({
      ...e, workflowName: names.get(e.workflowId) ?? e.workflowId, status: e.status ?? "error", instance: inst.name,
      url: `${inst.url}/workflow/${encodeURIComponent(e.workflowId)}/executions/${encodeURIComponent(e.id)}`,
    })) : [];
    const workflowsAvailable = inventory.status === "fulfilled";
    const executionsAvailable = executions.status === "fulfilled";
    return {
      name: inst.name, url: inst.url, ok: workflowsAvailable && executionsAvailable,
      workflows, errors, workflowsAvailable, executionsAvailable,
      workflowsPartial: inventory.status === "fulfilled" ? inventory.value : workflows.length > 0,
      errorsPartial: executions.status === "fulfilled" && Boolean(executions.value.nextCursor),
      error: inventory.status === "rejected" ? n8nError(inventory.reason) : undefined,
      executionsError: executions.status === "rejected" ? n8nError(executions.reason) : undefined,
    };
  }));
  return { configured: instances.length > 0, instances: results, documented: docs, documentationAvailable: source !== null };
}

/** Mesma cobertura para contexto e MCP, sem transformar consulta falha em zero. */
export function n8nInstanceSummary(instance: Awaited<ReturnType<typeof n8nOverview>>["instances"][number]) {
  const inventory = instance.workflowsAvailable || instance.workflows.length
    ? `${instance.workflows.filter(w => w.active).length}/${instance.workflows.length} workflows ativos${instance.workflowsPartial ? " na amostra; inventário incompleto" : ""}`
    : "inventário de workflows indisponível";
  const executions = instance.executionsAvailable
    ? `${instance.errors.length} falhas recentes retornadas (limite 25${instance.errorsPartial ? "; consulta parcial, há mais páginas" : ""})`
    : "consulta de falhas indisponível; ausência de falhas não confirmada";
  return `${instance.name}: ${inventory}; ${executions}.`;
}
