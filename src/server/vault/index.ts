import "server-only";
import matter from "gray-matter";
import { normalize } from "@/lib/text";
import { basename, createResolver, extractTags, extractWikiLinks } from "@/lib/wikilinks";
import { getVaultProvider, type VaultEntry } from "./provider";

export type VaultNote = {
  path: string;
  title: string;
  folder: string;
  sha: string;
  frontmatter: Record<string, unknown>;
  content: string; // markdown completo (com frontmatter)
  body: string; // sem frontmatter
  links: string[]; // caminhos resolvidos
  unresolved: string[];
  tags: string[];
  headings: string[];
};

export type VaultIndex = {
  version: string;
  files: VaultEntry[];
  notes: Map<string, VaultNote>;
  backlinks: Map<string, string[]>;
  resolve: (target: string) => string | null;
  builtAt: number;
};

const blobCache = new Map<string, string>();
let cached: VaultIndex | null = null;
let building: Promise<VaultIndex> | null = null;
const TTL = 30_000;

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

function parseNote(entry: VaultEntry, raw: string, resolve: (t: string) => string | null): VaultNote {
  let fm: Record<string, unknown> = {};
  let body = raw;
  try {
    const parsed = matter(raw);
    fm = JSON.parse(JSON.stringify(parsed.data ?? {}));
    body = parsed.content;
  } catch {}
  const links = new Set<string>();
  const unresolved = new Set<string>();
  for (const l of extractWikiLinks(body)) {
    const r = resolve(l.target);
    if (r) {
      if (r !== entry.path) links.add(r);
    } else if (l.target) unresolved.add(l.target);
  }
  const fmTags = Array.isArray(fm.tags) ? (fm.tags as unknown[]).map(String) : typeof fm.tags === "string" ? [fm.tags] : [];
  const parts = entry.path.split("/");
  return {
    path: entry.path,
    title: typeof fm.title === "string" && fm.title.trim() ? String(fm.title) : basename(entry.path),
    folder: parts.slice(0, -1).join("/"),
    sha: entry.sha,
    frontmatter: fm,
    content: raw,
    body,
    links: [...links],
    unresolved: [...unresolved],
    tags: [...new Set([...fmTags.map((t) => t.toLowerCase()), ...extractTags(body)])],
    headings: [...body.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => m[1].trim()),
  };
}

async function build(): Promise<VaultIndex> {
  const p = getVaultProvider();
  if (!p) throw new Error("Vault não configurado");
  const { version, entries } = await p.list();
  if (cached && cached.version === version) {
    cached.builtAt = Date.now();
    return cached;
  }
  const md = entries.filter((e) => /\.md$/i.test(e.path));
  const resolve = createResolver(md.map((e) => e.path));
  const contents = await pool(md, 12, async (e) => {
    const hit = blobCache.get(e.sha);
    if (hit !== undefined) return hit;
    const text = await p.read(e.path, p.kind === "github" ? e.sha : undefined);
    blobCache.set(e.sha, text);
    return text;
  });
  const notes = new Map<string, VaultNote>();
  md.forEach((e, i) => notes.set(e.path, parseNote(e, contents[i], resolve)));
  const backlinks = new Map<string, string[]>();
  for (const n of notes.values()) for (const l of n.links) {
    if (!backlinks.has(l)) backlinks.set(l, []);
    backlinks.get(l)!.push(n.path);
  }
  cached = { version, files: entries, notes, backlinks, resolve, builtAt: Date.now() };
  return cached;
}

export async function getVaultIndex(force = false): Promise<VaultIndex> {
  if (!force && cached && Date.now() - cached.builtAt < TTL) return cached;
  building ??= build().finally(() => (building = null));
  return building;
}

export function invalidateVault() {
  if (cached) cached.builtAt = 0;
}

export function rememberBlob(sha: string, content: string) {
  blobCache.set(sha, content);
}

export type SearchHit = { path: string; title: string; folder: string; snippet: string; score: number };

export async function searchVault(q: string, limit = 20): Promise<SearchHit[]> {
  if (!getVaultProvider()) return [];
  const idx = await getVaultIndex();
  const nq = normalize(q);
  const terms = nq.split(/\s+/).filter(Boolean);
  const hits: SearchHit[] = [];
  for (const n of idx.notes.values()) {
    const title = normalize(n.title);
    const body = normalize(n.body);
    let score = 0;
    if (title === nq) score += 100;
    else if (title.includes(nq)) score += 40;
    for (const t of terms) {
      if (title.includes(t)) score += 10;
      const occurrences = body.split(t).length - 1;
      if (!occurrences) {
        score = terms.length > 1 ? score : 0;
        if (terms.length > 1 && !title.includes(t)) score -= 15;
      }
      score += Math.min(occurrences, 10) * 2;
    }
    if (n.tags.some((t) => t.includes(nq))) score += 8;
    if (score <= 0) continue;
    const pos = body.indexOf(terms[0] ?? nq);
    const snippet = pos >= 0 ? n.body.slice(Math.max(0, pos - 60), pos + 120).replace(/\s+/g, " ").trim() : n.body.slice(0, 160).replace(/\s+/g, " ");
    hits.push({ path: n.path, title: n.title, folder: n.folder, snippet, score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export type TreeNode = { name: string; path: string; type: "dir" | "file"; children?: TreeNode[] };

export function buildTree(files: VaultEntry[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", type: "dir", children: [] };
  for (const f of files) {
    const parts = f.path.split("/");
    let node = root;
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      const p = parts.slice(0, i + 1).join("/");
      let child = node.children!.find((c) => c.name === part);
      if (!child) {
        child = { name: part, path: p, type: isFile ? "file" : "dir", children: isFile ? undefined : [] };
        node.children!.push(child);
      }
      node = child;
    });
  }
  const sort = (n: TreeNode) => {
    n.children?.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, "pt-BR", { numeric: true }) : a.type === "dir" ? -1 : 1));
    n.children?.forEach(sort);
  };
  sort(root);
  return root.children!;
}
