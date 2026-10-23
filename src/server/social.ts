import "server-only";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { createHash } from "node:crypto";

const channelSchema = z.object({ id: z.string(), name: z.string(), identifier: z.string(), disabled: z.boolean().optional(), profile: z.string().nullable().optional(), customer: z.object({ id: z.string(), name: z.string() }).nullable().optional() });
const channelsSchema = z.array(channelSchema);
export const metricsSchema = z.array(z.object({ label: z.string(), data: z.array(z.object({ total: z.union([z.string(), z.number().finite()]).transform(String), date: z.string() })), percentageChange: z.number().nullable().optional() }));
export type SocialMetric = z.infer<typeof metricsSchema>[number];
export type SocialChannel = z.infer<typeof channelSchema>;
export type SocialOverview = { configured: boolean; checkedAt: string; error: string | null; channels: (SocialChannel & { metrics: SocialMetric[]; error: string | null })[]; total?: number; available?: SocialChannel[]; days: 7 | 30 };
export function socialConfigured() { return Boolean(process.env.POSTIZ_API_URL && process.env.POSTIZ_API_KEY); }
export function socialPanelUrl() {
  try { const base = new URL(process.env.POSTIZ_API_URL!); return base.protocol === "https:" && !base.username && !base.password ? `${base.origin}/analytics` : null; } catch { return null; }
}
function cacheIdentity() { return createHash("sha256").update(`${process.env.POSTIZ_API_URL}:${process.env.POSTIZ_API_KEY}`).digest("hex"); }
async function postizRead(path: string): Promise<unknown> {
  const base = new URL(process.env.POSTIZ_API_URL!);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) throw new Error("Use a base HTTPS da API pública do Postiz, terminando em /public/v1.");
  const response = await fetch(`${base.toString().replace(/\/$/, "")}${path}`, { headers: { Authorization: process.env.POSTIZ_API_KEY!, "user-agent": "orbita", accept: "application/json" }, signal: AbortSignal.timeout(15000), cache: "no-store", redirect: "error" });
  if (!response.ok) throw new Error(response.status === 401 ? "Postiz recusou a chave da API (HTTP 401). Confira a conexão em Integrações." : response.status === 403 ? "Postiz recusou o acesso (HTTP 403). Confira as permissões do canal." : response.status === 429 ? "Limite de consultas do Postiz atingido (HTTP 429). Aguarde antes de atualizar." : `Postiz respondeu HTTP ${response.status}. Confira o canal no painel de origem.`);
  return response.json();
}
const readChannels = async () => channelsSchema.parse(await postizRead("/integrations"));
const cachedChannels = unstable_cache(async (identity: string) => { void identity; return readChannels(); }, ["postiz-channels-v3"], { revalidate: 300 });
export async function socialChannels() { return cachedChannels(cacheIdentity()); }
const readMetrics = async (id: string, days: number) => metricsSchema.parse(await postizRead(`/analytics/${encodeURIComponent(id)}?date=${days}`));
// Cache apenas de sucessos: falhas lançadas não ficam presas na visão por uma hora.
const cachedMetrics = unstable_cache(async (id: string, days: number, identity: string) => { void identity; return readMetrics(id, days); }, ["postiz-metrics-v3"], { revalidate: 3600 });
function safeError(error: unknown) {
  if (error instanceof z.ZodError) return "O Postiz retornou dados em formato incompatível. Confira a versão da API pública.";
  return error instanceof Error && /^(Postiz |Limite de consultas|Use a base)/.test(error.message) ? error.message : "Não foi possível consultar o Postiz agora. Confira a conexão e tente atualizar.";
}
export async function socialOverview(channelId?: string, days: 7 | 30 = 7, force = false): Promise<SocialOverview> {
  const checkedAt = new Date().toISOString();
  if (!socialConfigured()) return { configured: false, checkedAt, error: null, channels: [], days };
  try {
    const channels = await (force ? readChannels() : socialChannels());
    const selected = channelId ? channels.find((channel) => channel.id === channelId) : channels.find((channel) => !channel.disabled) ?? channels[0];
    if (channelId && !selected) return { configured: true, checkedAt, error: "Este canal não está mais disponível. Selecione outro canal.", channels: [], available: channels, total: channels.length, days };
    const results: SocialOverview["channels"] = [];
    if (selected) {
      let metrics: SocialMetric[] = [], error: string | null = null;
      if (!selected.disabled) {
        try { metrics = await (force ? readMetrics(selected.id, days) : cachedMetrics(selected.id, days, cacheIdentity())); }
        catch (e) { error = safeError(e); }
      }
      results.push({ ...selected, metrics, error });
    }
    return { configured: true, checkedAt, error: null, channels: results, total: channels.length, available: channels, days };
  } catch (e) { return { configured: true, checkedAt, error: safeError(e), channels: [], days }; }
}
