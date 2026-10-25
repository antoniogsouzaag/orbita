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
  activationFunnel: z.object({
    professional: z.number().int().nonnegative(), catalog: z.number().int().nonnegative(),
    readyForBooking: z.number().int().nonnegative(), firstAppointment: z.number().int().nonnegative(),
  }).optional(),
});
export type ProductMetrics = z.infer<typeof productMetricsSchema>;

export function validateProductMetrics(raw: unknown, product: string, now = Date.now()): ProductMetrics {
  const data = productMetricsSchema.parse(raw);
  if (data.product !== product) throw new Error("Produto divergente");
  if (Date.parse(data.window.from) > Date.parse(data.window.to) || Date.parse(data.generatedAt) > now + 300_000 || Date.parse(data.window.to) > now + 300_000) throw new Error("Janela inválida");
  if (data.activationFunnel) {
    const f = data.activationFunnel;
    const stages = [data.metrics.accounts, f.professional, f.catalog, f.readyForBooking, f.firstAppointment];
    if (product !== "barberias" || stages[0] == null || stages.some((value, index) => index > 0 && value! > stages[index - 1]!) || f.firstAppointment !== data.metrics.activatedAccounts) throw new Error("Funil inválido");
  }
  return data;
}
