import { z } from "zod";

const count = z.number().int().nonnegative().nullable();
/** Apenas agregados administrativos; nenhum cadastro, identidade ou segredo sai do app. */
export const productMetricsSchema = z.object({
  version: z.literal(1),
  product: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,59}$/),
  generatedAt: z.iso.datetime(),
  window: z.object({ from: z.iso.datetime(), to: z.iso.datetime() }),
  metrics: z.object({
    users: count, accounts: count, activeAccounts: count, trialAccounts: count,
    payingAccounts: count, complimentaryAccounts: count, canceledAccounts: count,
    activatedAccounts: count,
  }),
});
export type ProductMetrics = z.infer<typeof productMetricsSchema>;

export function validateProductMetrics(raw: unknown, product: string, now = Date.now()): ProductMetrics {
  const data = productMetricsSchema.parse(raw);
  if (data.product !== product) throw new Error("Produto divergente");
  if (Date.parse(data.window.from) > Date.parse(data.window.to) || Date.parse(data.generatedAt) > now + 300_000 || Date.parse(data.window.to) > now + 300_000) throw new Error("Janela inválida");
  return data;
}
