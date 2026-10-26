import { z } from "zod";

/** AG LABS App: modelo de créditos (assinatura mensal com créditos ou pacote avulso), janela de 30 dias do admin. */
const count = z.number().int().nonnegative();
export const creditsMetricsSchema = z.object({
  version: z.literal(1),
  currency: z.literal("BRL"),
  basis: z.literal("admin_analytics_30d"),
  users: z.object({ total: count, active30d: count, generating: count }),
  sales: z.object({ count, payingUsers: count, revenueCents: count }),
  subscriptions: z.object({
    active: count, trialing: count, mrrCents: count,
    byPlan: z.array(z.object({ plan: z.enum(["basic", "advanced", "premium"]), active: count })).max(3),
  }).nullable(),
  credits: z.object({ sold: count, purchased: count, bonus: count.nullable(), consumed: count, refunded: count }).nullable(),
  generations: count,
});
export type CreditsMetrics = z.infer<typeof creditsMetricsSchema>;

export function validateCreditsMetrics(data: CreditsMetrics, users: number | null) {
  const u = data.users, s = data.sales, sub = data.subscriptions;
  if (u.total !== users || u.active30d > u.total || u.generating > u.total) throw new Error("Usuários de créditos inválidos");
  if (s.payingUsers > s.count || s.payingUsers > u.total || (s.count === 0 && s.revenueCents !== 0)) throw new Error("Vendas de créditos inválidas");
  if (sub && (new Set(sub.byPlan.map((p) => p.plan)).size !== sub.byPlan.length || sub.byPlan.reduce((sum, p) => sum + p.active, 0) > sub.active)) throw new Error("Planos inválidos");
}
