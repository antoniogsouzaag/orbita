export type MdTable = { headings: string[]; headers: string[]; rows: string[][] };

/** Divide uma linha de tabela respeitando "\|" (usado em wikilinks com apelido). */
export function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let cur = "";
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (c === "\\" && trimmed[i + 1] === "|") {
      cur += "\\|";
      i++;
    } else if (c === "|") {
      cells.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  cells.push(cur.trim());
  return cells;
}

/** Extrai todas as tabelas markdown com a trilha de títulos onde aparecem. */
export function parseTables(md: string): MdTable[] {
  const lines = md.split(/\r?\n/);
  const out: MdTable[] = [];
  const stack: { level: number; text: string }[] = [];
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line.trim())) inCode = !inCode;
    if (inCode) continue;
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      stack.push({ level, text: h[2].trim() });
      continue;
    }
    if (line.trim().startsWith("|") && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? "")) {
      const headers = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      i--;
      out.push({ headings: stack.map((s) => s.text), headers, rows });
    }
  }
  return out;
}

/** Converte markdown inline simples em texto (remove **, `, links). */
export function plainText(cell: string): string {
  return cell
    .replace(/\[\[([^\]]+?)\]\]/g, (_, inner: string) => {
      const [left, alias] = inner.split(/\\?\|/);
      return (alias ?? left.split("#")[0]).trim();
    })
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\\\|/g, "|")
    .trim();
}

export function firstUrl(cell: string): string | null {
  const md = /\]\((https?:\/\/[^)\s]+)\)/.exec(cell);
  if (md) return md[1];
  const raw = /(https?:\/\/[^\s|)>\]`]+)/.exec(cell);
  return raw ? raw[1] : null;
}

export function firstWikiTarget(cell: string): string | null {
  const m = /\[\[([^\]]+?)\]\]/.exec(cell);
  if (!m) return null;
  return m[1].split(/\\?\|/)[0].split("#")[0].trim();
}
