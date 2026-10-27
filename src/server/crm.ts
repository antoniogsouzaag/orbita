import "server-only";
import type { CrmAccounts, CrmAggregateSummary } from "@/lib/crm-aggregates";

/**
 * Cliente do servidor MCP do CRM (aglabs-core/crm-dash, docs/mcp.md).
 * A Órbita pede, o CRM executa com as regras dele: sem acesso direto ao Supabase,
 * sem e-mail ou telefone dos contatos e sem mudar a etapa do funil.
 */

export type CrmTask = {
  id: string;
  titulo: string;
  descricao: string | null;
  prazo: string | null;
  prioridade: string | null;
  responsavel: "maia" | "leo" | "antonio" | "tecnico" | null;
  contato: { id: string; nome: string | null } | null;
  vencida: boolean;
};

export type CrmSummary = {
  /** Optional additions from CRM #41; legacy CRM remains supported. */
  produto?: string | null;
  contas_no_produto?: CrmAccounts;
  por_produto?: CrmAggregateSummary["por_produto"];
  cobertura?: string;
  hoje: string;
  funil: Record<"Lead" | "Contatado" | "Atendimento" | "Proposta" | "Pagamento", number>;
  oportunidades_abertas: number;
  clientes: number;
  clientes_inativos: number;
  contatos_a_qualificar: number;
  base_prospeccao: number;
  novos_7d: number;
  novos_30d: number;
  receita_total?: number;
  receita_mes: number;
  receita_mes_anterior: number;
  tarefas: { pendentes: number; vencidas: number; para_hoje: number; por_responsavel: Record<string, number> };
};

export const CRM_ASSIGNEE: Record<string, string> = { maia: "Maia", leo: "Léo", antonio: "Antonio", tecnico: "Técnico", sem_responsavel: "Sem responsável" };

export function crmConfigured() {
  return !!process.env.CRM_MCP_URL && !!process.env.CRM_MCP_TOKEN;
}

/** Endereço do painel do CRM (mesma origem do servidor MCP), para os links. */
export function crmUrl(path = "") {
  try {
    return new URL(path || "/", process.env.CRM_MCP_URL).toString();
  } catch {
    return null;
  }
}

let seq = 0;

/** Chama uma ferramenta do CRM. Erro de validação do CRM vira Error com a mensagem dele. */
export async function crmCall<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!crmConfigured()) throw new Error("CRM não conectado (CRM_MCP_URL e CRM_MCP_TOKEN)");
  const res = await fetch(process.env.CRM_MCP_URL!, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${process.env.CRM_MCP_TOKEN}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++seq, method: "tools/call", params: { name, arguments: args } }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("o CRM recusou o token (CRM_MCP_TOKEN)");
  if (res.status === 404) throw new Error("o servidor MCP ainda não está publicado no CRM");
  if (res.status === 503) throw new Error("falta CRM_MCP_TOKENS na Vercel do CRM");
  if (!res.ok) throw new Error(`CRM respondeu ${res.status}`);
  const body = (await res.json()) as { error?: { message: string }; result?: { isError?: boolean; structuredContent?: T; content?: { type: string; text?: string }[] } };
  if (body.error) throw new Error(body.error.message);
  const text = body.result?.content?.find((c) => c.type === "text")?.text ?? "";
  if (body.result?.isError) throw new Error(text || "o CRM recusou o pedido");
  return (body.result?.structuredContent ?? (text ? JSON.parse(text) : {})) as T;
}

let cache: { at: number; value: CrmOverview } | null = null;

export type CrmOverview =
  | { configured: false }
  | { configured: true; ok: false; error: string }
  | { configured: true; ok: true; summary: CrmSummary; mine: CrmTask[]; team: CrmTask[]; url: string | null };

/** Resumo para a Empresa e o bom dia: funil, receita e tarefas (as de Antonio e as do time vencidas ou de hoje). */
export async function crmOverview(maxAgeMs = 60_000): Promise<CrmOverview> {
  if (!crmConfigured()) return { configured: false };
  if (cache && Date.now() - cache.at < maxAgeMs) return cache.value;
  let value: CrmOverview;
  try {
    const [summary, mine, due] = await Promise.all([
      crmCall<CrmSummary>("crm_resumo"),
      crmCall<{ tarefas: CrmTask[] }>("crm_tarefas", { responsavel: "antonio", limite: 8 }),
      crmCall<{ tarefas: CrmTask[] }>("crm_tarefas", { situacao: "ate_hoje", limite: 12 }),
    ]);
    value = { configured: true, ok: true, summary, mine: mine.tarefas, team: due.tarefas.filter((t) => t.responsavel !== "antonio"), url: crmUrl() };
  } catch (e) {
    value = { configured: true, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  cache = { at: Date.now(), value };
  return value;
}

export function clearCrmCache() {
  cache = null;
}
