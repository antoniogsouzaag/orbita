import { z } from "zod";

export const CRM_FUNNEL = ["Lead", "Contatado", "Atendimento", "Proposta", "Pagamento"] as const;
export const CRM_ACCOUNTS = ["trial", "trial_encerrado", "ativo", "cancelado"] as const;
export const CRM_EMAIL_CATEGORIES = ["prospeccao", "campanha", "automacao", "transacional", "atendimento"] as const;
export const CRM_PIXEL_NOTE = "Abertura depende de pixel e pode incluir abertura automática do provedor; não comprova leitura humana.";
export const CRM_PRODUCT_COVERAGE = "Funil sem a base fria. Receita considera só pagamentos registrados com o produto; tarefas, só as ligadas a contatos do produto. Contas não comprovam pagamento.";

export const crmProductSchema = z.string().trim().min(2).max(60).regex(/^[a-z0-9][a-z0-9_-]{1,59}$/i);
export const crmSummaryInput = z.object({ produto: crmProductSchema.nullish() });
export const crmEmailInput = crmSummaryInput.extend({
  dias: z.number().int().min(1).max(365).nullish(),
  categoria: z.enum(CRM_EMAIL_CATEGORIES).nullish(),
});
export function crmProductKey(value?: string | null) {
  const key = value?.trim().toLowerCase();
  return key === "barberpro" ? "barberias" : key || undefined;
}

const count = z.number().int().nonnegative();
const amount = z.number().finite();
const counts = <T extends string>(keys: readonly T[]) => z.object(Object.fromEntries(keys.map((key) => [key, count.optional()])) as Record<T, z.ZodOptional<typeof count>>);
export const crmAccountsSchema = counts(CRM_ACCOUNTS);
const productTotals = z.object({
  oportunidades_abertas: count.optional(), clientes: count.optional(), base_prospeccao: count.optional(),
  novos_30d: count.optional(), contas: crmAccountsSchema.optional(),
});

// Whitelist: never forward unknown fields, contact records, or free text from the CRM.
export const crmSummarySchema = z.object({
  hoje: z.iso.date().optional(), produto: crmProductSchema.nullish(),
  funil: counts(CRM_FUNNEL).optional(), contas_no_produto: crmAccountsSchema.optional(),
  oportunidades_abertas: count.optional(), clientes: count.optional(), clientes_inativos: count.optional(),
  contatos_a_qualificar: count.optional(), base_prospeccao: count.optional(), novos_7d: count.optional(), novos_30d: count.optional(),
  receita_mes: amount.optional(), receita_mes_anterior: amount.optional(),
  tarefas: z.object({ pendentes: count.optional(), vencidas: count.optional(), para_hoje: count.optional(), por_responsavel: counts(["maia", "leo", "antonio", "tecnico", "sem_responsavel"]).optional() }).optional(),
  por_produto: z.record(z.string().regex(/^[a-z0-9][a-z0-9_-]{1,59}$/), productTotals).optional(),
});
const rate = z.number().finite().nonnegative().nullable().optional();
export const crmEmailTotalsSchema = z.object({
  enviados: count.optional(), entregues: count.optional(), abertos: count.optional(), cliques: count.optional(), respostas: count.optional(),
  falhas: count.optional(), descadastros: count.optional(),
  taxa_entrega: rate, taxa_abertura: rate, taxa_clique: rate, taxa_resposta: rate,
});
export const crmEmailSchema = z.object({
  produto: crmProductSchema.nullish(), categoria: z.enum(CRM_EMAIL_CATEGORIES).nullish(),
  desde: z.iso.datetime().optional(), dias: z.number().int().min(1).max(365).optional(),
  total: crmEmailTotalsSchema.optional(), campanhas: count.optional(), respostas_recebidas: count.optional(),
  por_categoria: z.object(Object.fromEntries(CRM_EMAIL_CATEGORIES.map((key) => [key, crmEmailTotalsSchema.optional()])) as Record<typeof CRM_EMAIL_CATEGORIES[number], z.ZodOptional<typeof crmEmailTotalsSchema>>).optional(),
});

export type CrmAccounts = z.infer<typeof crmAccountsSchema>;
export type CrmAggregateSummary = z.infer<typeof crmSummarySchema>;
export type CrmEmailFunnel = z.infer<typeof crmEmailSchema>;
export type CrmAggregateResult<T> = {
  source: "CRM MCP · crm_resumo" | "CRM MCP · crm_funil_emails";
  checkedAt: string;
  updatedAt: null; // The current CRM contract does not expose a source refresh timestamp.
  status: "ok" | "unavailable" | "not_configured";
  data: T | null;
  message?: string;
};
