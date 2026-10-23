import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "orbita_session";

function secret() {
  const s = process.env.SESSION_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "dev-secret-orbita-local-only");
  if (!s) throw new Error("SESSION_SECRET não configurado");
  return new TextEncoder().encode(s);
}

export async function signSession(): Promise<string> {
  return new SignJWT({ sub: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload.sub === "owner";
  } catch {
    return false;
  }
}
