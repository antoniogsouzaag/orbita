import "server-only";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { createHash } from "node:crypto";
import { preferredSocialChannel, socialGroupId } from "@/lib/business";

const channelSchema = z.object({ id: z.string(), name: z.string(), identifier: z.string(), disabled: z.boolean().optional(), profile: z.string().nullable().optional(), customer: z.object({ id: z.string(), name: z.string() }).nullable().optional() });
const channelsSchema = z.array(channelSchema);
export const metricsSchema = z.array(z.object({ label: z.string(), data: z.array(z.object({ total: z.union([z.string(), z.number().finite()]).transform(String), date: z.string() })), percentageChange: z.number().nullable().optional() }));
export type SocialMetric = z.infer<typeof metricsSchema>[number];
export type SocialChannel = z.infer<typeof channelSchema>;
export type SocialOverview = { configured: boolean; checkedAt: string; error: string | null; channels: (SocialChannel & { metrics: SocialMetric[]; error: string | null })[]; total?: number; available?: SocialChannel[]; days: 7 | 30; entityId?: string; productChannels?: SocialOverview["channels"] };
export function socialConfigured() { return Boolean(process.env.POSTIZ_API_URL && process.env.POSTIZ_API_KEY); }
export function socialPanelUrl() {
  try { const base = new URL(process.env.POSTIZ_API_URL!); return base.protocol === "https:" && !base.username && !base.password ? `${base.origin}/analytics` : null; } catch { return null; }
}
function cacheIdentity() { return createHash("sha256").update(`${process.env.POSTIZ_API_URL}:${process.env.POSTIZ_API_KEY}`).digest("hex"); }
async function postizRead(path: string): Promise<unknown> {
  const base = new URL(process.env.POSTIZ_API_URL!);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) throw new Error("Use a base HTTPS da API pública do Postiz, terminando em /public/v1.");
  const response = await fetch(`${base.toString().replace(/\/$/, "")}${path}`, { headers: { Authorization: process.env.POSTIZ_API_KEY!, "user-agent": "orbita", accept: "application/json" }, signal: AbortSignal.timeout(15000), cache: "no-store", redirect: "error" });
  if (!response.ok) throw new Error(response.status === 401 ? "Postiz recusou a chave da API (HTTP 401). Confira a conexão em Integrações." : response.status === 403 ? "Postiz recusou o acesso (HTTP 403). Confira as permissões do canal." : response.status === 429 ? "Limite de consultas do Postiz atingido (HTTP 429). Aguarde antes de atualizar." : response.status >= 500 ? `Postiz está temporariamente indisponível (HTTP ${response.status}). Tente atualizar novamente.` : `Postiz respondeu HTTP ${response.status}. Confira o canal no painel de origem.`);
  return response.json();
}
const readChannels = async () => channelsSchema.parse(await postizRead("/integrations"));
const cachedChannels = unstable_cache(async (identity: string) => { void identity; return readChannels(); }, ["postiz-channels-v4"], { revalidate: 60, tags: ["postiz-channels"] });
export async function socialChannels() { return cachedChannels(cacheIdentity()); }
const readMetrics = async (id: string, days: number) => metricsSchema.parse(await postizRead(`/analytics/${encodeURIComponent(id)}?date=${days}`));
// Cache apenas de sucessos: falhas lançadas não ficam presas na visão por uma hora.
const cachedMetrics = unstable_cache(async (id: string, days: number, identity: string) => { void identity; return readMetrics(id, days); }, ["postiz-metrics-v4"], { revalidate: 3600, tags: ["postiz-metrics"] });
function safeError(error: unknown) {
  if (error instanceof z.ZodError) return "O Postiz retornou dados em formato incompatível. Confira a versão da API pública.";
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return "O Postiz demorou mais de 15 segundos para responder. Tente atualizar novamente.";
  return error instanceof Error && /^(Postiz |Limite de consultas|Use a base)/.test(error.message) ? error.message : "Não foi possível consultar o Postiz agora. Confira a conexão e tente atualizar.";
}
export async function socialOverview(channelId?: string, days: 7 | 30 = 7, force = false, entity?: string): Promise<SocialOverview> {
  const checkedAt = new Date().toISOString();
  if (!socialConfigured()) return { configured: false, checkedAt, error: null, channels: [], days };
  try {
    const channels = await (force ? readChannels() : socialChannels());
    const entityId = entity ? socialGroupId(entity) : undefined;
    const candidates = entityId ? channels.filter((channel) => (channel.customer?.id ?? "ungrouped") === entityId) : channels;
    const selected = channelId ? candidates.find((channel) => channel.id === channelId) : preferredSocialChannel(candidates);
    if (entityId && !candidates.length) return { configured: true, checkedAt, error: "Nenhum canal retornado para esta entidade. Confira os grupos no Postiz ou escolha outra entidade.", channels: [], available: channels, total: channels.length, days, entityId };
    if (channelId && !selected) return { configured: true, checkedAt, error: "Este canal não está mais disponível nesta entidade. Selecione outro canal.", channels: [], available: channels, total: channels.length, days, entityId: entityId ?? candidates[0]?.customer?.id ?? "ungrouped" };
    const product = selected ? channels.filter(channel => (channel.customer?.id ?? "ungrouped") === (selected.customer?.id ?? "ungrouped")) : [];
    const productChannels = await Promise.all(product.map(async channel => {
      let metrics: SocialMetric[] = [], error: string | null = null;
      if (!channel.disabled) {
        try { metrics = await (force ? readMetrics(channel.id, days) : cachedMetrics(channel.id, days, cacheIdentity())); }
        catch (e) { error = safeError(e); }
      }
      return { ...channel, metrics, error };
    }));
    const results = productChannels.filter(channel => channel.id === selected?.id);
    return { configured: true, checkedAt, error: null, channels: results, productChannels, total: channels.length, available: channels, days, entityId: selected?.customer?.id ?? (selected ? "ungrouped" : entityId) };
  } catch (e) { return { configured: true, checkedAt, error: safeError(e), channels: [], days }; }
}
