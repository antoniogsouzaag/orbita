import "server-only";
import { firstUrl, firstWikiTarget, parseTables, plainText, type MdTable } from "@/lib/md-tables";
import { normalize } from "@/lib/text";
import { getVaultIndex, getVaultProvider, type VaultNote } from "@/server/vault";

/* ───────────── Leitura do vault ───────────── */

async function noteByName(name: string): Promise<VaultNote | null> {
  if (!getVaultProvider()) return null;
  const idx = await getVaultIndex();
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
  const idx = await getVaultIndex();
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
  if (!getVaultProvider()) return [];
  const idx = await getVaultIndex();
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
  const idx = await getVaultIndex();
  const t = parseTables(note.body).find((x) => col(x, "repositorio") >= 0 && col(x, "portao") >= 0);
  if (!t) return [];
  const [r0, b, c, g, f] = [col(t, "repositorio"), col(t, "branch"), col(t, "comando"), col(t, "portao"), col(t, "ficha")];
  return t.rows.map((r) => {
    const target = firstWikiTarget(r[f] ?? "");
    return { repo: plainText(r[r0] ?? ""), branch: plainText(r[b] ?? ""), check: plainText(r[c] ?? ""), gate: plainText(r[g] ?? ""), page: target ? plainText(r[f] ?? "") : null, pagePath: target ? idx.resolve(target) : null };
  });
}

export type DocumentedAutomation = { name: string; id: string | null; description: string; schedule: string; where: string };

export async function documentedAutomations(): Promise<DocumentedAutomation[]> {
  const note = await noteByName("Automações Ativas");
  if (!note) return [];
  const out: DocumentedAutomation[] = [];
  for (const t of parseTables(note.body)) {
    const n = col(t, "automacao", "tarefa", "rotina");
    if (n < 0) continue;
    const [i, fn, ex, onde] = [col(t, "id"), col(t, "funcao"), col(t, "execucao"), col(t, "onde")];
    const where = t.headings.find((h) => /n8n|claude|codex|aplica|clientes/i.test(h)) ?? t.headings.at(-1) ?? "";
    for (const r of t.rows)
      out.push({
        name: plainText(r[n] ?? ""),
        id: i >= 0 ? plainText(r[i] ?? "").replace(/,.*$/, "").trim() || null : null,
        description: fn >= 0 ? plainText(r[fn] ?? "") : "",
        schedule: ex >= 0 ? plainText(r[ex] ?? "") : "",
        where: onde >= 0 ? plainText(r[onde] ?? "") : where.replace(/\s*\(.*\)$/, ""),
      });
  }
  return out;
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
  const res = await fetch(`${inst.url}/api/v1${path}`, { headers: { "X-N8N-API-KEY": inst.apiKey, accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${inst.name}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function n8nOverview() {
  const instances = n8nInstances();
  const docs = await documentedAutomations().catch((): DocumentedAutomation[] => []);
  const byId = new Map(docs.filter((d) => d.id).map((d) => [d.id!, d]));
  const results = await Promise.all(
    instances.map(async (inst) => {
      try {
        const workflows: N8nWorkflow[] = [];
        let cursor: string | undefined;
        for (let page = 0; page < 10; page++) {
          const r = await n8nGet<{ data: { id: string; name: string; active: boolean; updatedAt: string; tags?: { name: string }[] }[]; nextCursor?: string | null }>(inst, `/workflows?limit=250${cursor ? `&cursor=${cursor}` : ""}`);
          for (const w of r.data) workflows.push({ id: w.id, name: w.name, active: w.active, updatedAt: w.updatedAt, tags: (w.tags ?? []).map((t) => t.name), instance: inst.name, documented: byId.get(w.id) ?? null });
          if (!r.nextCursor) break;
          cursor = r.nextCursor;
        }
        const ex = await n8nGet<{ data: { id: string; workflowId: string; status?: string; startedAt: string; stoppedAt: string | null }[] }>(inst, `/executions?status=error&limit=25`);
        const names = new Map(workflows.map((w) => [w.id, w.name]));
        const errors: N8nExecution[] = ex.data.map((e) => ({ id: e.id, workflowId: e.workflowId, workflowName: names.get(e.workflowId) ?? e.workflowId, status: e.status ?? "error", startedAt: e.startedAt, stoppedAt: e.stoppedAt, instance: inst.name, url: `${inst.url}/workflow/${e.workflowId}/executions/${e.id}` }));
        return { name: inst.name, url: inst.url, ok: true as const, workflows, errors };
      } catch (e) {
        return { name: inst.name, url: inst.url, ok: false as const, error: e instanceof Error ? e.message : String(e), workflows: [] as N8nWorkflow[], errors: [] as N8nExecution[] };
      }
    }),
  );
  return { configured: instances.length > 0, instances: results, documented: docs };
}
