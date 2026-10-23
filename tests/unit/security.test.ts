import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";
import { base32Decode, base32Encode, totp, verifyTotp } from "@/lib/totp";

describe("TOTP (RFC 6238)", () => {
  // Vetor oficial da RFC 6238 (SHA-1): segredo ASCII "12345678901234567890"
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  it("bate com os vetores da RFC", () => {
    expect(totp(secret, 59_000, 30, 8)).toBe("94287082");
    expect(totp(secret, 1111111109_000, 30, 8)).toBe("07081804");
    expect(totp(secret, 2000000000_000, 30, 8)).toBe("69279037");
  });
  it("aceita ±1 janela e rejeita códigos errados", () => {
    const now = 1_700_000_000_000;
    expect(verifyTotp(secret, totp(secret, now), now)).toBe(true);
    expect(verifyTotp(secret, totp(secret, now - 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totp(secret, now - 90_000), now)).toBe(false);
    expect(verifyTotp(secret, "12345", now)).toBe(false);
    expect(base32Decode(secret).toString()).toBe("12345678901234567890");
  });
});

describe("senha com scrypt", () => {
  it("valida só a senha certa", () => {
    const h = hashPassword("correta-horse-battery", 1024);
    expect(verifyPassword("correta-horse-battery", h)).toBe(true);
    expect(verifyPassword("errada", h)).toBe(false);
    expect(verifyPassword("x", "lixo")).toBe(false);
  });
});

/* Rede de segurança: toda ação e rota precisa checar autenticação. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const root = path.resolve(import.meta.dirname, "../../src/app");

describe("auditoria de autenticação", () => {
  it("toda Server Action exportada chama requireAuth (exceto login/logout)", () => {
    const files = walk(path.join(root, "actions")).filter((f) => f.endsWith(".ts"));
    const missing: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{([\s\S]*?)\n\}/g)) {
        const [, name, body] = m;
        if (["login", "logout"].includes(name)) continue;
        if (!/await requireAuth\(\)/.test(body)) missing.push(`${path.basename(f)}:${name}`);
      }
    }
    expect(missing).toEqual([]);
  });
  it("toda rota de API checa sessão ou token", () => {
    const routes = walk(path.join(root, "api")).filter((f) => f.endsWith("route.ts"));
    const open = routes.filter((f) => !/isAuthenticated\(\)|tokenMatches\(|verifyAgentToken\(/.test(readFileSync(f, "utf8")) && !f.includes(`${path.sep}health${path.sep}`));
    expect(open.map((f) => path.relative(root, f))).toEqual([]);
  });
});
