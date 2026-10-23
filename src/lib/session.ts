import { SignJWT, jwtVerify } from "jose";

/** Em produção usa o prefixo __Host- (só HTTPS, sem domínio, path=/). */
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-orbita" : "orbita_session";

function secret() {
  const s = process.env.SESSION_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "dev-secret-orbita-local-only");
  if (!s || (process.env.NODE_ENV === "production" && s.length < 32)) throw new Error("SESSION_SECRET ausente ou curto (mínimo 32 caracteres)");
  return new TextEncoder().encode(s);
}

export async function signSession(version: number): Promise<string> {
  return new SignJWT({ sub: "owner", v: version })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function readSession(token: string | undefined): Promise<{ v: number } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload.sub === "owner" ? { v: Number(payload.v ?? 0) } : null;
  } catch {
    return null;
  }
}

/** Usado no proxy: só confere assinatura e validade (sem banco). */
export async function verifySession(token: string | undefined): Promise<boolean> {
  return (await readSession(token)) !== null;
}
