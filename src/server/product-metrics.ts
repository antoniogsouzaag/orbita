import "server-only";
import { validateProductMetrics, type ProductMetrics } from "@/lib/product-metrics";

type Source = { product: string; url: string; token: string };
function sources(): Source[] {
  try {
    const rows: unknown = JSON.parse(process.env.APP_METRICS_SOURCES ?? "[]");
    return Array.isArray(rows) ? rows.filter((row): row is Source => row && typeof row.product === "string" && typeof row.url === "string" && typeof row.token === "string" && row.token.length >= 32) : [];
  } catch { return []; }
}
export type ProductMetricsResult = { status: "ok" | "stale" | "not_configured" | "unavailable"; checkedAt: string; data: ProductMetrics | null; message: string };

export async function productMetrics(product: string): Promise<ProductMetricsResult> {
  const checkedAt = new Date().toISOString();
  const source = sources().find(item => item.product === product);
  if (!source) return { status: "not_configured", checkedAt, data: null, message: "Coleta administrativa do app ainda não conectada. Os dados do CRM abaixo não substituem os usuários e assinaturas da origem." };
  try {
    const url = new URL(source.url);
    // Hosts explícitos do ecossistema; nenhuma URL do navegador define o destino.
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !["barberias.com.br", "www.barberias.com.br"].includes(url.hostname) || url.pathname !== "/api/integrations/orbita/metrics") throw new Error("Destino inválido");
    const response = await fetch(url, { headers: { authorization: `Bearer ${source.token}`, accept: "application/json" }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error("Origem indisponível");
    const data = validateProductMetrics(await response.json(), product);
    const stale = Date.now() - Date.parse(data.generatedAt) > 24 * 3_600_000;
    return { status: stale ? "stale" : "ok", checkedAt, data, message: stale ? "Snapshot da origem há mais de 24 horas. Confira a coleta." : "Agregados consultados no app." };
  } catch { return { status: "unavailable", checkedAt, data: null, message: "A coleta administrativa não respondeu com um contrato válido. Nenhum zero foi presumido." }; }
}
