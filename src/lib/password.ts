import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Formato: scrypt$N$sal_base64$hash_base64 */
export function hashPassword(password: string, N = 16384): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N, r: 8, p: 1 });
  return `scrypt$${N}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [alg, n, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !n || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const got = scryptSync(password, Buffer.from(salt, "base64"), expected.length, { N: Number(n), r: 8, p: 1 });
  return timingSafeEqual(expected, got);
}
