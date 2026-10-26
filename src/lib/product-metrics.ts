import { z } from "zod";
import { marketplaceMetricsSchema, validateMarketplaceMetrics } from "./marketplace-metrics";
import { creditsMetricsSchema, validateCreditsMetrics } from "./credits-metrics";
import { audienceMetricsSchema, validateAudienceMetrics } from "./audience-metrics";

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
  marketplace: marketplaceMetricsSchema.optional(),
  credits: creditsMetricsSchema.optional(),
  audience: audienceMetricsSchema.optional(),
});
export type ProductMetrics = z.infer<typeof productMetricsSchema>;

export function validateProductMetrics(raw: unknown, product: string, now = Date.now()): ProductMetrics {
  const data = productMetricsSchema.parse(raw);
  if (data.product !== product) throw new Error("Produto divergente");
  if (data.audience) {
    if (product === "vibekit") throw new Error("Compra única não mede usuários");
    validateAudienceMetrics(data.audience, data.metrics.users, data.generatedAt, product);
  }
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
  if (product === "members") {
    if (Object.entries(data.metrics).some(([key, value]) => key !== "users" && value !== null)) throw new Error("Unidade de marketplace inválida");
    if (data.marketplace) {
      if (Date.parse(data.window.to) > Date.parse(data.generatedAt)) throw new Error("Geração de marketplace inválida");
      validateMarketplaceMetrics(data.marketplace, data.window, data.metrics.users);
    }
  } else if (data.marketplace) throw new Error("Produto de marketplace divergente");
  if (product === "aglabs-app") {
    if (Object.entries(data.metrics).some(([key, value]) => key !== "users" && value !== null)) throw new Error("Unidade de créditos inválida");
    if (data.credits) {
      if (Date.parse(data.window.to) > Date.parse(data.generatedAt)) throw new Error("Geração de créditos inválida");
      if (Date.parse(data.window.to) - Date.parse(data.window.from) !== 30 * 86_400_000 || Date.parse(data.window.to) !== Date.parse(data.generatedAt)) throw new Error("Janela de créditos inválida");
      validateCreditsMetrics(data.credits, data.metrics.users);
    }
  } else if (data.credits) throw new Error("Produto de créditos divergente");
  return data;
}
