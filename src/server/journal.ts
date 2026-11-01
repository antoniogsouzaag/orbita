import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, gte, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { opsEvents } from "@/db/schema";
import { shiftDate, today, zonedToUtc } from "@/lib/dates";
import { JOURNAL_KIND, journalHref, journalInput, journalQueryInput, type JournalArticle } from "@/lib/journal";

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

/** Editorial history only. It deliberately excludes personal data, CRM records and operational alerts. */
export async function journalFeed(date = today()) {
  const db = await getDb();
  const from = zonedToUtc(date), until = zonedToUtc(shiftDate(date, 1));
  const rows = await db.select().from(opsEvents).where(or(
    and(eq(opsEvents.kind, JOURNAL_KIND), gte(opsEvents.createdAt, new Date(Date.now() - 31 * 86_400_000)), sql`${opsEvents.detail}->'article'->>'data' = ${date}`),
    and(eq(opsEvents.kind, "agente_resumo"), gte(opsEvents.createdAt, from), lt(opsEvents.createdAt, until)),
  )).orderBy(desc(opsEvents.createdAt), desc(opsEvents.id)).limit(121);
  const articles: JournalArticle[] = [];
  let invalid = 0;
  for (const row of rows.slice(0, 120)) {
    if (row.kind === JOURNAL_KIND) {
      const parsed = journalInput.safeParse(row.detail.article);
      if (!parsed.success) { invalid++; continue; }
      const { registro_id: _registration, ...article } = parsed.data;
      void _registration;
      articles.push({ ...article, id: row.id, autor: typeof row.detail.author === "string" ? row.detail.author.slice(0, 100) : row.source, recebidoEm: row.createdAt.toISOString(), legado: false });
    } else {
      const content = typeof row.detail.message === "string" ? row.detail.message : "Resumo sem detalhes adicionais.";
      // Legacy reports are labelled as unclassified, never inferred to be news or mailbox coverage.
      articles.push({ id: row.id, data: date, secao: "operacao", titulo: row.subject, resumo: content.slice(0, 500), conteudo: content, destaque: false, pontos: [], fontes: [], autor: typeof row.detail.agent === "string" ? row.detail.agent : row.source.replace(/^agente:/, ""), recebidoEm: row.createdAt.toISOString(), legado: true });
    }
  }
  return { data: date, articles, parcial: rows.length > 120 || invalid > 0, consultadoEm: new Date().toISOString() };
}

export async function journalSummary(raw: unknown = {}) {
  const { data = today(), inicio = 0, limite = 5 } = journalQueryInput.parse(raw);
  const edition = await journalFeed(data);
  const items = edition.articles.slice(inicio, inicio + limite).map(({ conteudo: _body, ...item }) => { void _body; return item; });
  return { data: edition.data, materias: items, parcial: edition.parcial, proximo_inicio: inicio + limite < edition.articles.length ? inicio + limite : null, consultado_em: edition.consultadoEm, href: journalHref(edition.data) };
}
