import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, signSession, verifySession } from "./session";

/** Compara senhas em tempo constante (via hash, para tamanhos diferentes). */
export function passwordMatches(input: string): boolean {
  const expected = process.env.ORBITA_PASSWORD;
  if (!expected) return process.env.NODE_ENV !== "production" && input.length > 0;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function createSession() {
  const token = await signSession();
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function isAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/** Use no topo de toda Server Action e página protegida. */
export async function requireAuth() {
  if (!(await isAuthenticated())) redirect("/login");
}

/** Para rotas de API com token (feed de agenda, contexto para agentes). */
export function tokenMatches(provided: string | null | undefined, envName: string): boolean {
  const expected = process.env[envName];
  if (!expected || !provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
