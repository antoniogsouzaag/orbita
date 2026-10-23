import "server-only";
import { unstable_cache } from "next/cache";
import { z } from "zod";

const channelsSchema = z.array(z.object({ id: z.string(), name: z.string(), identifier: z.string(), disabled: z.boolean().optional() }));
const metricsSchema = z.array(z.object({ label: z.string(), data: z.array(z.object({ total: z.string(), date: z.string() })), percentageChange: z.number().nullable().optional() }));
export type SocialMetric = z.infer<typeof metricsSchema>[number];

export function socialConfigured() { return Boolean(process.env.POSTIZ_API_URL && process.env.POSTIZ_API_KEY); }
async function postizRead(path: string): Promise<unknown> {
  const base = new URL(process.env.POSTIZ_API_URL!);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) throw new Error("URL inválida");
  const response = await fetch(`${base.toString().replace(/\/$/, "")}${path}`, {
    headers: { Authorization: process.env.POSTIZ_API_KEY! },
    signal: AbortSignal.timeout(10000), cache: "no-store", redirect: "error",
  });
  if (!response.ok) throw new Error("Postiz indisponível");
  return response.json();
}

export const socialChannels = unstable_cache(async () => channelsSchema.parse(await postizRead("/integrations")), ["postiz-channels-v2"], { revalidate: 3600 });
export const socialOverview = unstable_cache(async (channelId?: string) => {
  const checkedAt = new Date().toISOString();
  if (!socialConfigured()) return { configured: false, checkedAt, error: null, channels: [] };
  try {
    const channels = await socialChannels();
    const selected = channels.find((channel) => channel.id === channelId) ?? channels.find((channel) => !channel.disabled) ?? channels[0];
    const results = [];
    // Sequencial para respeitar os limites da API pública e não bloquear todos os canais por 429.
    for (const channel of selected ? [selected] : []) {
      let metrics: SocialMetric[] = [];
      let error: string | null = null;
      if (!channel.disabled) {
        try { metrics = metricsSchema.parse(await postizRead(`/analytics/${encodeURIComponent(channel.id)}?date=7`)); }
        catch { error = "Métricas indisponíveis para este canal. Confira acesso, versão e permissões da rede no Postiz."; }
      }
      results.push({ ...channel, metrics, error });

    }
    return { configured: true, checkedAt, error: null, channels: results, total: channels.length, available: channels };
  } catch {
    return { configured: true, checkedAt, error: "Não foi possível consultar o Postiz. Confira POSTIZ_API_URL (incluindo /public/v1), chave e versão instalada.", channels: [] };
  }
}, ["postiz-overview-v2"], { revalidate: 3600 });
