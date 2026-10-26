import { z } from "zod";

const count = z.number().int().nonnegative().nullable();
export const commerceFunnelSchema = z.object({
  version: z.literal(1),
  events: z.object({ pageViews: count, pricingViews: count, ctaClicks: count, checkoutClicks: count, checkoutCreated: count, checkoutFailures: count, successViews: count }),
  observedFrom: z.iso.datetime().nullable(),
  registeredPurchases: z.number().int().nonnegative(),
  provisionedPurchases: z.number().int().nonnegative(),
  registeredCheckoutAmountCents: count,
  currency: z.literal("BRL"),
  basis: z.literal("anonymous_event_counts_and_registered_live_checkout_records"),
});
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
  commerceFunnel: commerceFunnelSchema.optional(),
  /** Marketplace (Members): unidade é o produtor; receita da plataforma vem das vendas. */
  marketplace: z.object({
    version: z.literal(1),
    currency: z.literal("BRL"),
    currentMonth: z.object({ from: z.iso.datetime(), grossCents: z.number().int().nonnegative(), platformFeeCents: z.number().int().nonnegative(), paidItems: z.number().int().nonnegative() }),
    previousMonth: z.object({ from: z.iso.datetime(), to: z.iso.datetime(), grossCents: z.number().int().nonnegative(), platformFeeCents: z.number().int().nonnegative(), paidItems: z.number().int().nonnegative() }),
    producers: z.object({ onboarding: z.number().int().nonnegative(), approved: z.number().int().nonnegative() }),
    users: z.object({ total: z.number().int().nonnegative(), new30d: z.number().int().nonnegative() }),
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
  if (product === "vibekit") {
    const f = data.commerceFunnel;
    if (!f || Object.values(data.metrics).some(value => value !== null) || Date.parse(data.window.to) > Date.parse(data.generatedAt)
      || f.provisionedPurchases > f.registeredPurchases || (f.registeredPurchases === 0 && f.registeredCheckoutAmountCents !== 0)
      || (f.observedFrom !== null && Date.parse(f.observedFrom) > Date.parse(data.window.to))) throw new Error("Funil comercial inválido");
    const known = Object.values(f.events).filter(value => value !== null).length;
    if ((known !== 0 && known !== Object.keys(f.events).length) || (known > 0 && f.observedFrom === null)) throw new Error("Cobertura comercial inválida");
  } else if (data.commerceFunnel) throw new Error("Unidade comercial divergente");
  if (data.marketplace) {
    const m = data.marketplace;
    if (product !== "members" || m.producers.approved > m.producers.onboarding || m.users.total !== data.metrics.users
      || [m.currentMonth, m.previousMonth].some((p) => p.platformFeeCents > p.grossCents)) throw new Error("Marketplace inválido");
  }
  return data;
}
