import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPassword } from "./password";
import { SESSION_COOKIE, readSession, signSession } from "./session";
import { verifyTotp } from "./totp";

function safeEqual(a: string, b: string) {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

/**
 * Senha definida no próprio app (Configurações → Segurança) tem prioridade;
 * sem ela, vale ORBITA_PASSWORD_HASH (scrypt) ou ORBITA_PASSWORD do ambiente.
 */
export async function passwordMatchesAny(input: string): Promise<boolean> {
  const s = await securityState(true);
  if (s.passwordHash) {
    try {
      return verifyPassword(input, s.passwordHash);
    } catch {
      return false;
    }
  }
  return passwordMatches(input);
}

/** Só as variáveis de ambiente: ORBITA_PASSWORD_HASH (scrypt, recomendado) ou ORBITA_PASSWORD. */
export function passwordMatches(input: string): boolean {
  const hash = process.env.ORBITA_PASSWORD_HASH;
  if (hash) {
    try {
      return verifyPassword(input, hash);
    } catch {
      return false;
    }
  }
  const plain = process.env.ORBITA_PASSWORD;
  if (!plain) return false; // sem senha configurada ninguém entra
  return safeEqual(input, plain);
}

/* ── Estado de segurança guardado no banco (2FA, versão da sessão, bloqueio) ── */

type SecurityState = { totpSecret: string | null; totpEnabled: boolean; sessionVersion: number; failed: number; lockedUntil: number; passwordHash: string | null };

async function settingsApi() {
  const { getRawSetting, setRawSetting } = await import("@/server/security-store");
  return { getRawSetting, setRawSetting };
}

let cache: { at: number; state: SecurityState } | null = null;

export async function securityState(fresh = false): Promise<SecurityState> {
  if (!fresh && cache && Date.now() - cache.at < 15_000) return cache.state;
  const { getRawSetting } = await settingsApi();
  const raw = ((await getRawSetting("security")) ?? {}) as Partial<SecurityState>;
  const envSecret = process.env.ORBITA_TOTP_SECRET || null;
  const state: SecurityState = {
    totpSecret: envSecret ?? raw.totpSecret ?? null,
    totpEnabled: Boolean(envSecret) || Boolean(raw.totpEnabled && raw.totpSecret),
    sessionVersion: raw.sessionVersion ?? 0,
    failed: raw.failed ?? 0,
    lockedUntil: raw.lockedUntil ?? 0,
    passwordHash: raw.passwordHash ?? null,
  };
  cache = { at: Date.now(), state };
  return state;
}

export async function updateSecurity(patch: Partial<SecurityState>) {
  const { getRawSetting, setRawSetting } = await settingsApi();
  const raw = ((await getRawSetting("security")) ?? {}) as Partial<SecurityState>;
  await setRawSetting("security", { ...raw, ...patch });
  cache = null;
}

export async function checkTotp(code: string | null | undefined): Promise<boolean> {
  const s = await securityState(true);
  if (!s.totpEnabled) return true;
  return Boolean(code && s.totpSecret && verifyTotp(s.totpSecret, code));
}

export async function createSession() {
  const s = await securityState(true);
  const token = await signSession(s.sessionVersion);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Sessão válida = assinatura ok + versão igual à atual (permite "sair de todos os dispositivos"). */
export async function isAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  const session = await readSession(jar.get(SESSION_COOKIE)?.value);
  if (!session) return false;
  const s = await securityState();
  return session.v === s.sessionVersion;
}

/** Use no topo de toda Server Action e página protegida. */
export async function requireAuth() {
  if (!(await isAuthenticated())) redirect("/login");
}

/** Para rotas de API com token (feed de agenda, ingestão do n8n, contexto para agentes). */
export function tokenMatches(provided: string | null | undefined, envName: string): boolean {
  const expected = process.env[envName];
  if (!expected || expected.length < 16 || !provided) return false;
  return safeEqual(provided, expected);
}
