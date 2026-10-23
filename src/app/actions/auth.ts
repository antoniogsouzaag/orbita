"use server";

import { redirect } from "next/navigation";
import { checkTotp, createSession, destroySession, passwordMatchesAny, requireAuth, securityState, updateSecurity } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { generateSecret, otpauthUri, verifyTotp } from "@/lib/totp";

const MAX_FAILS = 5;
const LOCK_MS = 5 * 60_000;

export async function login(_: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const s = await securityState(true);
  if (s.lockedUntil > Date.now()) {
    const min = Math.ceil((s.lockedUntil - Date.now()) / 60_000);
    return { error: `Muitas tentativas. Tente de novo em ${min} min.` };
  }
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "");
  const ok = (await passwordMatchesAny(password)) && (await checkTotp(code));
  if (!ok) {
    const failed = s.failed + 1;
    await updateSecurity({ failed: failed >= MAX_FAILS ? 0 : failed, lockedUntil: failed >= MAX_FAILS ? Date.now() + LOCK_MS : 0 });
    await new Promise((r) => setTimeout(r, 600));
    return { error: s.totpEnabled ? "Senha ou código incorretos." : "Senha incorreta." };
  }
  if (s.failed || s.lockedUntil) await updateSecurity({ failed: 0, lockedUntil: 0 });
  await createSession();
  const next = String(formData.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

/** Invalida todas as sessões (todos os dispositivos), inclusive a atual. */
export async function logoutEverywhere() {
  await requireAuth();
  const s = await securityState(true);
  await updateSecurity({ sessionVersion: s.sessionVersion + 1 });
  await destroySession();
  redirect("/login");
}

export async function startTotpSetup() {
  await requireAuth();
  const s = await securityState(true);
  if (process.env.ORBITA_TOTP_SECRET) return { error: "2FA definido por variável de ambiente." };
  const secret = generateSecret();
  await updateSecurity({ totpSecret: secret, totpEnabled: false });
  return { secret, uri: otpauthUri(secret, process.env.OWNER_NAME ?? "dono"), enabled: s.totpEnabled };
}

export async function confirmTotp(code: string) {
  await requireAuth();
  const s = await securityState(true);
  if (!s.totpSecret || !verifyTotp(s.totpSecret, code)) return { ok: false, error: "Código inválido. Confira o horário do celular e tente o código atual." };
  await updateSecurity({ totpEnabled: true, sessionVersion: s.sessionVersion + 1 });
  await createSession(); // mantém este dispositivo conectado; os demais precisam entrar de novo com o código
  return { ok: true };
}

export async function disableTotp(code: string) {
  await requireAuth();
  const s = await securityState(true);
  if (process.env.ORBITA_TOTP_SECRET) return { ok: false, error: "2FA definido por variável de ambiente." };
  if (s.totpEnabled && (!s.totpSecret || !verifyTotp(s.totpSecret, code))) return { ok: false, error: "Código inválido." };
  await updateSecurity({ totpEnabled: false, totpSecret: null });
  return { ok: true };
}

/** Troca a senha pelo próprio app. Desconecta os outros dispositivos e mantém este. */
export async function changePassword(current: string, next: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAuth();
  if (!(await passwordMatchesAny(current))) {
    await new Promise((r) => setTimeout(r, 600));
    return { ok: false, error: "Senha atual incorreta." };
  }
  if (next.length < 10) return { ok: false, error: "A nova senha precisa de pelo menos 10 caracteres." };
  if (next.length > 200) return { ok: false, error: "Senha longa demais." };
  if (next === current) return { ok: false, error: "A nova senha é igual à atual." };
  const s = await securityState(true);
  await updateSecurity({ passwordHash: hashPassword(next), sessionVersion: s.sessionVersion + 1, failed: 0, lockedUntil: 0 });
  await createSession();
  return { ok: true };
}
