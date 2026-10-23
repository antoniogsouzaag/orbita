import { normalize } from "./text";

export type WikiLink = { target: string; heading?: string; alias?: string; embed: boolean; raw: string };

// [[alvo#seção|apelido]] — o "|" pode vir escapado como "\|" dentro de tabelas.
const WIKI_RE = /(!?)\[\[([^\[\]\n]+?)\]\]/g;

export function parseWikiTarget(inner: string): { target: string; heading?: string; alias?: string } {
  const [left, ...aliasParts] = inner.split(/\\?\|/);
  const alias = aliasParts.length ? aliasParts.join("|").trim() : undefined;
  const [target, ...h] = left.split("#");
  return { target: target.trim(), heading: h.length ? h.join("#").trim() : undefined, alias };
}

export function extractWikiLinks(md: string): WikiLink[] {
  const out: WikiLink[] = [];
  for (const m of md.matchAll(WIKI_RE)) {
    const { target, heading, alias } = parseWikiTarget(m[2]);
    out.push({ target, heading, alias, embed: m[1] === "!", raw: m[0] });
  }
  return out;
}

export function basename(path: string) {
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.md$/i, "");
}

/**
 * Resolve um alvo de wikilink como o Obsidian: caminho exato, depois nome do arquivo
 * (sem diferenciar maiúsculas); havendo vários, o caminho mais curto vence.
 */
export function createResolver(paths: string[]) {
  const byName = new Map<string, string[]>();
  const byPath = new Map<string, string>();
  for (const p of paths) {
    const key = normalize(basename(p));
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(p);
    byPath.set(normalize(p.replace(/\.md$/i, "")), p);
    byPath.set(normalize(p), p);
  }
  for (const list of byName.values()) list.sort((a, b) => a.length - b.length);
  return (target: string): string | null => {
    if (!target) return null;
    const t = normalize(target.replace(/^\.?\//, ""));
    return byPath.get(t) ?? byPath.get(`${t}.md`) ?? byName.get(normalize(basename(target)))?.[0] ?? null;
  };
}

/** Tags inline (#tag) ignorando títulos markdown, cores hex e âncoras de link. */
export function extractTags(md: string): string[] {
  const tags = new Set<string>();
  const clean = md.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");
  for (const m of clean.matchAll(/(?:^|\s)#([\p{L}][\p{L}\p{N}_/-]*)/gu)) tags.add(m[1].toLowerCase());
  return [...tags];
}
