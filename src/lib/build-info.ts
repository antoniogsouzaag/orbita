/** Repositório do código da Órbita (público). */
export const ORBITA_REPO = "antoniogsouzaag/orbita";

/** Commit do build em 7 caracteres, gravado pelo next.config.ts; null quando o build não soube qual era. */
export function buildCommit(): string | null {
  const sha = process.env.ORBITA_COMMIT ?? "";
  return /^[0-9a-f]{7,40}$/.test(sha) ? sha.slice(0, 7) : null;
}

/** Compara dois commits pelo prefixo comum (curto contra completo). */
export function sameCommit(a: string, b: string): boolean {
  const n = Math.min(a.length, b.length);
  return n >= 7 && a.slice(0, n) === b.slice(0, n);
}
