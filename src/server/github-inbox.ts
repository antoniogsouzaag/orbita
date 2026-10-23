import "server-only";

/**
 * O que está esperando decisão de Antonio no GitHub da AG LABS:
 * PRs abertos e issues "Proposta:" (etiqueta proposta) ainda sem aprovado/recusado.
 * Lê ao vivo (com cache curto); nada é copiado para o banco.
 */
export type InboxItem = { kind: "pr" | "proposta"; title: string; repo: string; url: string; number: number; updatedAt: string; author: string; draft?: boolean };
export type GithubInbox = { configured: boolean; items: InboxItem[]; error: string | null };

const ORG = process.env.GITHUB_ORG ?? "aglabs-core";
let cache: { at: number; data: GithubInbox } | null = null;

function token() {
  return process.env.GITHUB_INBOX_TOKEN || process.env.GITHUB_TOKEN || "";
}

type SearchItem = { title: string; html_url: string; number: number; updated_at: string; repository_url: string; user?: { login: string }; draft?: boolean; pull_request?: unknown };

async function search(q: string): Promise<SearchItem[]> {
  const res = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=30`, {
    headers: { authorization: `Bearer ${token()}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "orbita" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(res.status === 401 ? "token do GitHub inválido" : res.status === 403 ? "token sem permissão ou limite atingido" : `GitHub ${res.status}`);
  return ((await res.json()) as { items: SearchItem[] }).items;
}

export async function githubInbox(): Promise<GithubInbox> {
  if (!token()) return { configured: false, items: [], error: null };
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.data;
  try {
    const [prs, props] = await Promise.all([
      search(`org:${ORG} is:pr is:open archived:false`),
      search(`org:${ORG} is:issue is:open label:proposta -label:aprovado -label:recusado archived:false`),
    ]);
    const map = (k: InboxItem["kind"]) => (i: SearchItem): InboxItem => ({ kind: k, title: i.title, repo: i.repository_url.split("/").pop() ?? "", url: i.html_url, number: i.number, updatedAt: i.updated_at, author: i.user?.login ?? "", draft: i.draft });
    const data: GithubInbox = { configured: true, items: [...prs.map(map("pr")), ...props.map(map("proposta"))].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), error: null };
    cache = { at: Date.now(), data };
    return data;
  } catch (e) {
    return { configured: true, items: [], error: e instanceof Error ? e.message : String(e) };
  }
}
