import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getRawSetting } from "./settings";
import { setRawSetting } from "./security-store";

/**
 * Chave pessoal do atalho do iPhone (Atalhos/Siri). Só o hash fica no banco;
 * o valor aparece uma única vez, ao gerar. Gerar outra invalida a anterior.
 */
type Stored = { hash: string; prefix: string; createdAt: number; lastUsedAt?: number };

const sha = (s: string) => createHash("sha256").update(s).digest();

export async function captureTokenInfo(): Promise<{ prefix: string; createdAt: number; lastUsedAt: number | null } | null> {
  const s = (await getRawSetting("capture_token")) as Stored | undefined;
  return s?.hash ? { prefix: s.prefix, createdAt: s.createdAt, lastUsedAt: s.lastUsedAt ?? null } : null;
}

export async function createCaptureToken(): Promise<string> {
  const token = `cap_${randomBytes(24).toString("base64url")}`;
  await setRawSetting("capture_token", { hash: sha(token).toString("hex"), prefix: token.slice(0, 8), createdAt: Date.now() } satisfies Stored);
  return token;
}

export async function revokeCaptureToken() {
  await setRawSetting("capture_token", {});
}

export async function verifyCaptureToken(bearer: string | null | undefined): Promise<boolean> {
  if (!bearer || !bearer.startsWith("cap_") || bearer.length < 20) return false;
  const s = (await getRawSetting("capture_token")) as Stored | undefined;
  if (!s?.hash) return false;
  const ok = timingSafeEqual(sha(bearer), Buffer.from(s.hash, "hex"));
  if (ok && (!s.lastUsedAt || Date.now() - s.lastUsedAt > 60_000)) await setRawSetting("capture_token", { ...s, lastUsedAt: Date.now() });
  return ok;
}

/** "café 12,50" ou "uber 23.90 transporte" → despesa sem precisar da IA. */
export function parseExpense(texto: string): { descricao: string; valor: number; categoria: string | null } | null {
  const m = /(?:r\$\s*)?(\d{1,7}(?:[.,]\d{1,2})?)/i.exec(texto);
  if (!m) return null;
  const valor = Number(m[1].replace(",", "."));
  if (!Number.isFinite(valor) || valor <= 0) return null;
  const resto = texto.replace(m[0], " ").replace(/\b(reais|real|gastei|paguei|com|de|no|na)\b/gi, " ").replace(/\s+/g, " ").trim();
  const [descricao, ...cat] = resto.split(/\s+#/);
  return { descricao: descricao.trim() || "Gasto", valor, categoria: cat[0]?.trim() || null };
}
