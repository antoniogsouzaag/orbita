import "server-only";
import { auditDeliveries, linksIn, type ByCodeRow, type PerPostRow } from "@/lib/social-delivery";
import { listSocialPosts } from "./social-posts";
import { n8nInstances } from "./ops";

// Tabelas de entrega da AG LABS no n8n (documentadas no LEIA-ME do repo marketing).
export const DELIVERY_TABLES = { perPost: "MSG POR POST AGLABS", byCode: "MSG INSTAGRAM AGLABS" } as const;
// IDs conhecidos (n8na, projeto pessoal). A listagem da API pode não enxergar tabelas de projeto pessoal,
// então lemos direto pelo ID; N8N_DELIVERY_TABLES ({"perPost":"…","byCode":"…"}) sobrescreve.
const KNOWN_IDS: Record<keyof typeof DELIVERY_TABLES, string> = (() => {
  const base = { perPost: "NmoSW3oj920vyunS", byCode: "QjeiVUFbUvLlYtCx" };
  try { return { ...base, ...JSON.parse(process.env.N8N_DELIVERY_TABLES ?? "{}") }; } catch { return base; }
})();

type Table = { id: string; name: string };
type Page<T> = { data?: T[]; nextCursor?: string | null };

async function get<T>(url: string, apiKey: string): Promise<T> {
  const res = await fetch(url, { headers: { "X-N8N-API-KEY": apiKey, accept: "application/json" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`n8n respondeu HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function readRows<T>(inst: { url: string; apiKey: string }, id: string): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | null | undefined;
  do {
    const page = await get<Page<T>>(`${inst.url}/api/v1/data-tables/${id}/rows?limit=250${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, inst.apiKey);
    rows.push(...(page.data ?? []));
    cursor = page.nextCursor;
  } while (cursor && rows.length < 5000);
  return rows;
}

/** Lê a tabela pelo ID conhecido; se nenhuma instância a tiver, procura pelo nome na listagem. */
async function readTable<T>(key: keyof typeof DELIVERY_TABLES): Promise<T[] | null> {
  const errors: string[] = [];
  for (const inst of n8nInstances()) {
    try { return await readRows<T>(inst, KNOWN_IDS[key]); } catch (e) { errors.push(`${inst.name}: ${e instanceof Error ? e.message : e}`); }
  }
  for (const inst of n8nInstances()) {
    const tables = await get<Page<Table>>(`${inst.url}/api/v1/data-tables?limit=100`, inst.apiKey).catch(() => null);
    const table = tables?.data?.find(t => t.name === DELIVERY_TABLES[key]);
    if (table) return readRows<T>(inst, table.id);
  }
  lastErrors = errors;
  return null;
}
let lastErrors: string[] = [];

async function status(url: string) {
  try { return (await fetch(url, { method: "HEAD", redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(8_000) })).status; }
  catch { return 0; }
}

export async function runDeliveryAudit() {
  if (!n8nInstances().length) return { configurado: false as const, erro: "N8N_INSTANCES não configurado na Órbita." };
  const [perPost, byCode, posts] = await Promise.all([readTable<PerPostRow>("perPost"), readTable<ByCodeRow>("byCode"), listSocialPosts()]);
  if (!perPost || !byCode) return { configurado: true as const, erro: `Tabela não encontrada: ${!perPost ? DELIVERY_TABLES.perPost : DELIVERY_TABLES.byCode}.`, detalhe: lastErrors };
  const live = posts.filter(p => p.brand === "aglabs" && p.network === "instagram" && ["agendado", "publicado"].includes(p.stage) && p.checks?.keyword);
  const links = [...new Set([...perPost, ...byCode].flatMap(r => linksIn(r.mensagem)).filter(l => /conteudo\.aglabs\.ia\.br/.test(l)))];
  const linkStatus = Object.fromEntries(await Promise.all(links.map(async l => [l, await status(l)] as const)));
  const issues = auditDeliveries({ perPost, byCode, linkStatus, posts: live.map(p => ({ id: p.id, title: p.title, keyword: p.checks!.keyword!, mediaId: p.checks?.mediaId })) });
  return { configurado: true as const, conferido_em: new Date().toISOString(), linhas_por_post: perPost.length, codigos: byCode.length, posts_conferidos: live.length, links_testados: links.length, erros: issues.filter(i => i.level === "erro").length, problemas: issues };
}
