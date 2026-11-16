import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { opsEvents } from "@/db/schema";
import { localDate, shiftDate, today, zonedToUtc } from "@/lib/dates";
import { JOURNAL_KIND, journalHref, journalInput, journalReadInput, type JournalArticle } from "@/lib/journal";

export class JournalError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

/** Actor-scoped deterministic UUID: retry is atomic even across separate serverless instances. */
export function journalReceiptId(actorId: string, registrationId: string) {
  const hash = createHash("sha256").update(`orbita:journal:${actorId}:${registrationId}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function submitJournalArticle(actor: { id: string; name: string }, raw: unknown) {
  const input = journalInput.parse(raw);
  const currentDay = today();
  if (input.data > currentDay || input.data < shiftDate(currentDay, -30)) throw new JournalError("data_fora_da_janela", "A edição deve ser de hoje ou dos últimos 30 dias, no fuso de São Paulo.");
  const id = journalReceiptId(actor.id, input.registro_id);
  const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const source = `jornal:${actor.id}`;
  const db = await getDb();
  const inserted = await db.insert(opsEvents).values({ id, kind: JOURNAL_KIND, severity: "info", source, subject: input.titulo, detail: { article: input, author: actor.name, fingerprint } }).onConflictDoNothing({ target: opsEvents.id }).returning({ id: opsEvents.id });
  if (!inserted.length) {
    const [existing] = await db.select().from(opsEvents).where(eq(opsEvents.id, id));
    if (!existing || existing.kind !== JOURNAL_KIND || existing.source !== source || existing.detail.fingerprint !== fingerprint) throw new JournalError("registro_conflitante", "Esse registro_id já foi usado com outro conteúdo. Releia o recibo; uma matéria nova precisa de outro UUID.");
  }
  return { id, registro_id: input.registro_id, data: input.data, repetido: !inserted.length, href: `${journalHref(input.data)}#materia-${id}` };
}

const LEGACY_KIND = "agente_resumo";
/** Same window as the 30-day retention of ops_events, with one day of slack for the São Paulo edition boundary. */
const retentionStart = () => new Date(Date.now() - 31 * 86_400_000);

/** Maps a stored row to an article; null when a journal payload no longer passes the contract. */
function toArticle(row: typeof opsEvents.$inferSelect): JournalArticle | null {
  if (row.kind === JOURNAL_KIND) {
    const parsed = journalInput.safeParse(row.detail.article);
    if (!parsed.success) return null;
    const { registro_id: _registration, ...article } = parsed.data;
    void _registration;
    return { ...article, id: row.id, autor: typeof row.detail.author === "string" ? row.detail.author.slice(0, 100) : row.source, recebidoEm: row.createdAt.toISOString(), legado: false };
  }
  const content = typeof row.detail.message === "string" ? row.detail.message : "Resumo sem detalhes adicionais.";
  // Legacy reports are labelled as unclassified, never inferred to be news or mailbox coverage.
  return { id: row.id, data: localDate(row.createdAt), secao: "operacao", titulo: row.subject, resumo: content.slice(0, 500), conteudo: content, destaque: false, pontos: [], fontes: [], autor: typeof row.detail.agent === "string" ? row.detail.agent : row.source.replace(/^agente:/, ""), recebidoEm: row.createdAt.toISOString(), legado: true };
}

/** Editorial history only. It deliberately excludes personal data, CRM records and operational alerts. */
export async function journalFeed(date = today()) {
  const db = await getDb();
  const from = zonedToUtc(date), until = zonedToUtc(shiftDate(date, 1));
  const rows = await db.select().from(opsEvents).where(or(
    and(eq(opsEvents.kind, JOURNAL_KIND), gte(opsEvents.createdAt, retentionStart()), sql`${opsEvents.detail}->'article'->>'data' = ${date}`),
    and(eq(opsEvents.kind, LEGACY_KIND), gte(opsEvents.createdAt, from), lt(opsEvents.createdAt, until)),
  )).orderBy(desc(opsEvents.createdAt), desc(opsEvents.id)).limit(121);
  const articles: JournalArticle[] = [];
  let invalid = 0;
  for (const row of rows.slice(0, 120)) {
    const article = toArticle(row);
    if (article) articles.push(article); else invalid++;
  }
  return { data: date, articles, parcial: rows.length > 120 || invalid > 0, consultadoEm: new Date().toISOString() };
}

/** Full text of one article by id: one primary-key lookup, restricted to editorial kinds inside retention. */
async function readJournalArticle(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(opsEvents).where(and(eq(opsEvents.id, id), inArray(opsEvents.kind, [JOURNAL_KIND, LEGACY_KIND]), gte(opsEvents.createdAt, retentionStart())));
  if (!row) throw new JournalError("materia_nao_encontrada", "Nenhuma matéria do Jornal com esse id dentro da retenção de 30 dias. Use ler_jornal sem id para listar a edição e obter os ids.");
  const materia = toArticle(row);
  if (!materia) throw new JournalError("materia_invalida", "A matéria existe, mas o registro não atende mais ao contrato do Jornal e não pode ser lido com segurança.");
  return { modo: "materia" as const, materia, href: `${journalHref(materia.data)}#materia-${materia.id}`, consultado_em: new Date().toISOString() };
}

/** Paginated edition without full text: the agent picks what to open by id. */
async function journalEdition(data = today(), inicio = 0, limite = 5) {
  const edition = await journalFeed(data);
  const items = edition.articles.slice(inicio, inicio + limite).map(({ conteudo: _body, ...item }) => { void _body; return item; });
  return { modo: "edicao" as const, data: edition.data, materias: items, parcial: edition.parcial, proximo_inicio: inicio + limite < edition.articles.length ? inicio + limite : null, consultado_em: edition.consultadoEm, href: journalHref(edition.data) };
}

/** Single read entry point for MCP and ORBE: no id lists the edition, id opens one article. */
export async function readJournal(raw: unknown = {}) {
  const { id, data, inicio, limite } = journalReadInput.parse(raw);
  return id ? readJournalArticle(id) : journalEdition(data, inicio, limite);
}
