import "server-only";
import { createHash } from "node:crypto";
import { issueStage, type GithubStage } from "@/lib/github-triage";

/**
 * Trabalho aberto do ecossistema: revisão de PR, execução técnica e decisões.
 * Triagem é explícita por etiquetas; não transforma todo bug em aprovação humana.
 * Lê ao vivo (com cache curto); nada é copiado para o banco.
 */
export type InboxItem = { kind: "pr" | "proposta"; title: string; repo: string; url: string; number: number; updatedAt: string; author: string; draft?: boolean; stage?: GithubStage; blocked?: boolean; labels?: string[] };
export type GithubInbox = {
  configured: boolean;
  items: InboxItem[];
  error: string | null;
  org: string;
  credential: "GITHUB_INBOX_TOKEN" | "GITHUB_TOKEN" | "VAULT_GITHUB_TOKEN" | null;
  checkedAt: string | null;
  total: number;
  truncated: boolean;
  warning: string;
  stale?: boolean;
};

let cache: { key: string; at: number; data: GithubInbox } | null = null;

function token() {
  return process.env.GITHUB_INBOX_TOKEN || process.env.GITHUB_TOKEN || process.env.VAULT_GITHUB_TOKEN || "";
}

/** Só metadados podem atravessar a fronteira do servidor; nunca o valor da credencial. */
export function githubInboxConfig() {
  const credential: GithubInbox["credential"] = process.env.GITHUB_INBOX_TOKEN ? "GITHUB_INBOX_TOKEN" : process.env.GITHUB_TOKEN ? "GITHUB_TOKEN" : process.env.VAULT_GITHUB_TOKEN ? "VAULT_GITHUB_TOKEN" : null;
  const org = process.env.GITHUB_ORG?.trim() || "aglabs-core";
  const warning = credential === "VAULT_GITHUB_TOKEN"
    ? "Usando o acesso já configurado para o Knowledge. A lista só inclui repositórios visíveis a esse token; um token restrito ao vault não oferece visão de toda a organização."
    : "A lista inclui os repositórios visíveis ao token. Uma busca sem resultados não comprova cobertura de todos os repositórios privados da organização.";
  return { configured: credential !== null, credential, org, warning };
}

type SearchItem = { title: string; html_url: string; number: number; updated_at: string; repository_url: string; user?: { login: string }; draft?: boolean; pull_request?: unknown; labels?: { name: string }[] };
type SearchResult = { items: SearchItem[]; total_count: number; incomplete_results?: boolean };

async function search(q: string): Promise<SearchResult> {
  const res = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=100`, {
    headers: { authorization: `Bearer ${token()}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "orbita" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(res.status === 401 ? "Token do GitHub inválido ou expirado." : res.status === 403 || res.status === 429 ? "O GitHub recusou a consulta: confira permissões, aprovação da organização e limite da API." : res.status === 422 ? "A organização ou os repositórios consultados não estão acessíveis a este token." : `GitHub respondeu HTTP ${res.status}.`);
  return await res.json() as SearchResult;
}

export async function githubInbox(options: { force?: boolean } = {}): Promise<GithubInbox> {
  const config = githubInboxConfig();
  const empty = { ...config, items: [], error: null, checkedAt: null, total: 0, truncated: false };
  if (!config.configured) return empty;
  const key = createHash("sha256").update(`${config.org}:${token()}`).digest("hex");
  if (!options.force && cache?.key === key && Date.now() - cache.at < 5 * 60_000) return cache.data;
  try {
    const [prs, props] = await Promise.all([
      search(`org:${config.org} is:pr is:open archived:false`),
      search(`org:${config.org} is:issue is:open label:proposta,execucao,decisao -label:recusado archived:false`),
    ]);
    const map = (k: InboxItem["kind"]) => (i: SearchItem): InboxItem => ({ kind: k, title: i.title, repo: i.repository_url.split("/").pop() ?? "", url: i.html_url, number: i.number, updatedAt: i.updated_at, author: i.user?.login ?? "", draft: i.draft, ...(k === "proposta" ? { labels: (i.labels ?? []).map(label => label.name), stage: issueStage((i.labels ?? []).map(label => label.name)), blocked: (i.labels ?? []).some(label => label.name.toLowerCase() === "bloqueado") } : {}) });
    const items = [...prs.items.map(map("pr")), ...props.items.map(map("proposta"))].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const total = prs.total_count + props.total_count;
    const data: GithubInbox = { ...config, items, error: null, checkedAt: new Date().toISOString(), total, truncated: total > items.length || Boolean(prs.incomplete_results || props.incomplete_results) };
    cache = { key, at: Date.now(), data };
    return data;
  } catch (e) {
    // Mensagens de transporte podem carregar URLs/cabeçalhos. Só erros conhecidos chegam à UI.
    const message = e instanceof Error && /^(Token do GitHub|O GitHub|A organização|GitHub respondeu)/.test(e.message) ? e.message : "Não foi possível consultar o GitHub agora. Tente novamente.";
    if (cache?.key === key && !cache.data.error && cache.data.items.length) return { ...cache.data, error: message, stale: true };
    const data: GithubInbox = { ...empty, checkedAt: new Date().toISOString(), error: message };
    cache = { key, at: Date.now() - 4 * 60_000, data };
    return data;
  }
}

/** Corpo de uma proposta já retornada pela busca autorizada. Nenhuma URL livre. */
export async function githubProposalBody(item: InboxItem, org: string): Promise<string | null> {
  if (item.kind !== "proposta" || !/^[a-zA-Z0-9_-]+$/.test(org) || !/^[a-zA-Z0-9_.-]+$/.test(item.repo)
    || item.url !== `https://github.com/${org}/${item.repo}/issues/${item.number}`) return null;
  try {
    const res = await fetch(`https://api.github.com/repos/${org}/${item.repo}/issues/${item.number}`, { headers: { authorization: `Bearer ${token()}`, accept: "application/vnd.github+json", "user-agent": "orbita" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const body = await res.json();
    return body.number === item.number && typeof body.body === "string" ? body.body.slice(0, 20_000) + (body.body.length > 20_000 ? "\n\nConteúdo truncado. Consulte a origem para ler o restante." : "") : null;
  } catch { return null; }
}
