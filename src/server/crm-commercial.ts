import "server-only";
import { z } from "zod";
import { crmCall, crmConfigured } from "./crm";
import {
  CRM_PIXEL_NOTE, CRM_PRODUCT_COVERAGE, crmProductKey, crmSummaryInput, crmEmailInput,
  crmSummarySchema, crmEmailSchema, type CrmAggregateResult, type CrmAggregateSummary, type CrmEmailFunnel,
} from "@/lib/crm-aggregates";

async function aggregate<T>(name: "crm_resumo" | "crm_funil_emails", args: Record<string, unknown>, schema: z.ZodType<T>): Promise<CrmAggregateResult<T>> {
  const meta = { source: `CRM MCP · ${name}` as const, checkedAt: new Date().toISOString(), updatedAt: null };
  if (!crmConfigured()) return { ...meta, status: "not_configured", data: null, message: "CRM não conectado. Ausência de dados não é zero." };
  try {
    const data = schema.parse(await crmCall(name, args));
    return { ...meta, checkedAt: new Date().toISOString(), status: "ok", data };
  } catch {
    return { ...meta, status: "unavailable", data: null, message: "Consulta indisponível ou resposta incompatível. Confira a conexão e a versão do CRM; nenhum zero foi presumido." };
  }
}

export async function crmCommercialSummary(input: z.infer<typeof crmSummaryInput> = {}): Promise<CrmAggregateResult<CrmAggregateSummary>> {
  const produto = crmProductKey(crmSummaryInput.parse(input).produto);
  const schema = crmSummarySchema.refine((data) => (produto ? data.produto === produto : data.produto == null) && (
    Object.values(data.funil ?? {}).some((value) => value !== undefined) || data.clientes !== undefined ||
    data.oportunidades_abertas !== undefined || Object.values(data.contas_no_produto ?? {}).some((value) => value !== undefined)
  ));
  return aggregate("crm_resumo", produto ? { produto } : {}, schema);
}

export async function crmEmailFunnel(input: z.infer<typeof crmEmailInput> = {}): Promise<CrmAggregateResult<CrmEmailFunnel>> {
  const parsed = crmEmailInput.parse(input);
  const produto = crmProductKey(parsed.produto);
  const args = { ...(produto ? { produto } : {}), dias: parsed.dias ?? 30, ...(parsed.categoria ? { categoria: parsed.categoria } : {}) };
  const schema = crmEmailSchema.refine((data) => (produto ? data.produto === produto : data.produto == null) &&
    (parsed.categoria ? data.categoria === parsed.categoria : data.categoria == null) && data.dias === args.dias && !!data.desde &&
    [data.total?.enviados, data.total?.entregues, data.total?.abertos, data.total?.cliques, data.total?.respostas, data.total?.falhas, data.total?.descadastros].some((value) => value !== undefined));
  return aggregate("crm_funil_emails", args, schema);
}

export const crmCommercialNotes = { coverage: CRM_PRODUCT_COVERAGE, pixel: CRM_PIXEL_NOTE };

export async function crmPrioritySummary(input: z.infer<typeof crmSummaryInput> = {}) {
  const product = crmProductKey(crmSummaryInput.parse(input).produto);
  const meta = { source: 'CRM MCP · crm_prioridades', checkedAt: new Date().toISOString() };
  if (!crmConfigured()) return { ...meta, status: 'not_configured', data: null };
  try {
    const schema = z.object({ produto: z.string().nullable(), consultado_em: z.iso.datetime(), tarefas_vencidas: z.number().int().nonnegative(), testes_encerrados: z.number().int().nonnegative(), sem_proximo_passo: z.number().int().nonnegative() });
    const data = schema.parse(await crmCall('crm_prioridades', product ? { produto: product } : {}));
    if (data.produto !== (product ?? null)) throw new Error('product mismatch');
    return { ...meta, status: 'ok', data, coverage: 'Tarefas vencidas, encerramento de teste confirmado e oportunidades sem tarefa pendente. Uma pessoa pode ter múltiplas ações. Confira histórico e outros canais no CRM; nenhum contato ou disparo foi autorizado.' };
  } catch {
    return { ...meta, status: 'unavailable', data: null, message: 'Consulta indisponível ou incompatível. Nenhuma ausência de pendências foi presumida.' };
  }
}
