/**
 * Valida uma imagem enviada como data URL (já reduzida no navegador).
 * Confere o tipo declarado, o tamanho e a assinatura real dos bytes.
 */
export type ParsedImage = { ok: true; type: "image/webp" | "image/png" | "image/jpeg"; data: string } | { ok: false; error: string };

export const MAX_IMAGE_DATA_URL = 700_000;
export const MAX_IMAGE_BYTES = 400_000;

export function parseImageDataUrl(dataUrl: unknown): ParsedImage {
  if (typeof dataUrl !== "string" || dataUrl.length > MAX_IMAGE_DATA_URL) return { ok: false, error: "Imagem grande demais" };
  const m = /^data:(image\/(?:webp|png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return { ok: false, error: "Formato de imagem não suportado" };
  const type = m[1] as "image/webp" | "image/png" | "image/jpeg";
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, error: "Imagem grande demais" };
  const magic = bytes.subarray(0, 12).toString("latin1");
  const valid =
    (type === "image/png" && magic.startsWith("\x89PNG")) ||
    (type === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8) ||
    (type === "image/webp" && magic.startsWith("RIFF") && magic.slice(8, 12) === "WEBP");
  if (!valid) return { ok: false, error: "Arquivo de imagem inválido" };
  return { ok: true, type, data: m[2] };
}
