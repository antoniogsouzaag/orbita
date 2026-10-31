/** Auditoria das entregas por palavra-chave (pura, sem rede). Detecta os erros que já aconteceram:
 *  post sem media_id na tabela, palavra-chave errada, página misturada e link quebrado. */

export type PerPostRow = { codigo: string; media_id: string; mensagem: string; nota?: string | null };
export type ByCodeRow = { codigo: string; mensagem: string };
export type AuditPost = { id: string; title: string; keyword: string; mediaId?: string | null };
export type DeliveryIssue = { level: "erro" | "aviso"; kind: string; message: string; ref?: string };

const norm = (s: string) => s.trim().toUpperCase();
/** Links de entrega na mensagem (sem pontuação final). */
export const linksIn = (text: string) => [...text.matchAll(/https?:\/\/[^\s)"'<>]+/g)].map(m => m[0].replace(/[.,;!?]+$/, ""));

export function auditDeliveries(input: { perPost: PerPostRow[]; byCode: ByCodeRow[]; posts: AuditPost[]; linkStatus?: Record<string, number> }): DeliveryIssue[] {
  const issues: DeliveryIssue[] = [];
  const byMedia = new Map<string, PerPostRow[]>();
  for (const r of input.perPost) {
    const id = r.media_id?.trim();
    if (!id) { issues.push({ level: "erro", kind: "sem_media_id", message: `Linha ${norm(r.codigo)} sem media_id na tabela por post: nunca será usada.`, ref: r.nota ?? undefined }); continue; }
    byMedia.set(id, [...(byMedia.get(id) ?? []), r]);
    if (!linksIn(r.mensagem).length) issues.push({ level: "aviso", kind: "sem_link", message: `media_id ${id} (${norm(r.codigo)}) entrega mensagem sem link.`, ref: r.nota ?? undefined });
  }
  for (const [id, rows] of byMedia) if (rows.length > 1) issues.push({ level: "erro", kind: "media_duplicado", message: `media_id ${id} aparece ${rows.length} vezes (${rows.map(r => norm(r.codigo)).join(", ")}): a entrega fica ambígua.` });

  // Página misturada: o mesmo link de conteúdo entregue por posts diferentes.
  const linkOwners = new Map<string, Set<string>>();
  for (const r of input.perPost) for (const l of linksIn(r.mensagem)) if (/conteudo\./.test(l)) linkOwners.set(l, new Set([...(linkOwners.get(l) ?? []), r.media_id]));
  for (const [link, owners] of linkOwners) if (owners.size > 1) issues.push({ level: "aviso", kind: "pagina_repetida", message: `${link} é entregue por ${owners.size} posts diferentes. Confira se não houve página misturada.` });

  const codes = new Set(input.byCode.map(r => norm(r.codigo)));
  for (const p of input.posts) {
    const kw = norm(p.keyword);
    const row = p.mediaId ? byMedia.get(p.mediaId.trim())?.[0] : undefined;
    if (row && norm(row.codigo) !== kw) issues.push({ level: "erro", kind: "keyword_errada", message: `"${p.title}": a legenda pede ${kw}, mas a tabela por post espera ${norm(row.codigo)}.`, ref: p.id });
    else if (!row && p.mediaId && codes.has(kw)) issues.push({ level: "aviso", kind: "so_fallback", message: `"${p.title}": sem linha por post (media_id ${p.mediaId}); quem comentar ${kw} recebe a mensagem genérica do código.`, ref: p.id });
    else if (!row && !codes.has(kw)) issues.push({ level: "erro", kind: "keyword_ausente", message: `"${p.title}": ${kw} não está em nenhuma tabela. Quem comentar não recebe nada.`, ref: p.id });
    else if (!p.mediaId) issues.push({ level: "aviso", kind: "post_sem_media_id", message: `"${p.title}": publicado sem media_id registrado no Órbita; não dá para conferir a entrega específica.`, ref: p.id });
  }

  for (const [link, status] of Object.entries(input.linkStatus ?? {})) if (status < 200 || status >= 400) issues.push({ level: "erro", kind: "link_quebrado", message: `${link} respondeu ${status || "sem resposta"}.` });
  return issues.sort((a, b) => Number(a.level === "aviso") - Number(b.level === "aviso"));
}
