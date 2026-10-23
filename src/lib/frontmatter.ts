/** Atualiza (ou não) o campo `updated:` do frontmatter sem reescrever o resto do arquivo. */
export function bumpUpdated(md: string, date: string): string {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md);
  if (!m) return md;
  if (!/^updated:/m.test(m[1])) return md;
  const fm = m[1].replace(/^updated:.*$/m, `updated: ${date}`);
  return md.replace(m[1], fm);
}

export function newNoteTemplate(title: string, date: string, type = "nota"): string {
  return `---\ntitle: ${title}\ntype: ${type}\nstatus: ativo\ncreated: ${date}\nupdated: ${date}\n---\n\n# ${title}\n\n`;
}
