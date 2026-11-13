import { normalize } from "./text";
import { parseTables } from "./md-tables";

type Note = { path: string; title: string; links: string[]; unresolved: string[]; frontmatter: Record<string, unknown>; body?: string };
export function auditVault(notes: Note[]) {
  const connected = new Set(notes.flatMap((note) => note.links));
  const titles = new Map<string, string[]>();
  for (const note of notes) {
    const title = normalize(note.title);
    titles.set(title, [...(titles.get(title) ?? []), note.path]);
  }
  return {
    total: notes.length,
    broken: notes.filter((note) => note.unresolved.length).map((note) => ({ path: note.path, targets: note.unresolved })),
    orphans: notes.filter((note) => !note.links.length && !connected.has(note.path)).map((note) => note.path),
    metadata: notes.filter((note) => !note.path.startsWith("Templates/") && (!note.frontmatter.type || !note.frontmatter.status)).map((note) => note.path),
    duplicates: [...titles.values()].filter((paths) => paths.length > 1),
    tables: notes.flatMap(note => parseTables(note.body ?? "").flatMap(table => table.rows.flatMap((row, index) => row.length === table.headers.length ? [] : [{ path: note.path, expected: table.headers.length, actual: row.length, row: index + 1, heading: table.headings.at(-1) ?? "" }]))),
  };
}
