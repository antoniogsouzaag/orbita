/**
 * Janela deslizante de pedidos (sem rede). Usada para o limite do Postiz: o servidor público conta só
 * a criação de post (POST /public/v1/posts), por organização, por hora — API_LIMIT, 30 no docker-compose.
 */
export class RateWindow {
  private calls: number[] = [];
  private blockedUntil = 0;
  constructor(readonly limit: number, readonly windowMs: number) {}

  private prune(now: number) { this.calls = this.calls.filter(t => now - t < this.windowMs); }
  record(now = Date.now()) { this.prune(now); this.calls.push(now); }
  /** O Postiz recusou (429): ninguém tenta antes de `until`. */
  block(until: number) { this.blockedUntil = Math.max(this.blockedUntil, until); }
  state(now = Date.now()) {
    this.prune(now);
    return { limit: this.limit, used: this.calls.length, remaining: Math.max(0, this.limit - this.calls.length), blockedUntil: this.blockedUntil > now ? this.blockedUntil : null };
  }
  /** Momento a partir do qual cabem `n` pedidos (agora, se já cabem). */
  availableAt(n: number, now = Date.now()) {
    this.prune(now);
    const blocked = this.blockedUntil > now ? this.blockedUntil : now;
    if (n > this.limit) return null;
    const over = this.calls.length + n - this.limit;
    const free = over <= 0 ? now : this.calls[over - 1] + this.windowMs;
    return Math.max(blocked, free);
  }
  reset() { this.calls = []; this.blockedUntil = 0; }
  /** Estado para guardar (sobrevive a reinício do servidor). */
  snapshot(now = Date.now()) { this.prune(now); return { calls: [...this.calls], blockedUntil: this.blockedUntil > now ? this.blockedUntil : 0 }; }
  /** Junta um estado guardado (deste ou de outro processo) com o da memória, sem contar o mesmo pedido duas vezes. */
  merge(saved: { calls?: unknown; blockedUntil?: unknown } | null | undefined, now = Date.now()) {
    if (!saved) return;
    const calls = Array.isArray(saved.calls) ? saved.calls.filter((t): t is number => typeof t === "number" && Number.isFinite(t)) : [];
    // Multiconjunto: cada instante vale o maior número de vezes que aparece em um dos lados (dois pedidos no mesmo
    // milissegundo contam dois; o estado que este processo gravou e lê de volta não conta em dobro).
    const count = (list: number[]) => list.reduce((m, t) => m.set(t, (m.get(t) ?? 0) + 1), new Map<number, number>());
    const mine = count(this.calls), theirs = count(calls);
    this.calls = [...new Set([...mine.keys(), ...theirs.keys()])].flatMap(t => Array<number>(Math.max(mine.get(t) ?? 0, theirs.get(t) ?? 0)).fill(t)).sort((a, b) => a - b);
    if (typeof saved.blockedUntil === "number") this.blockedUntil = Math.max(this.blockedUntil, saved.blockedUntil);
    this.prune(now);
  }
}

/** Espera pedida numa resposta 429: Retry-After (segundos ou data) ou X-RateLimit-Reset (segundos). */
export function retryAfterMs(headers: Headers, now = Date.now()): number | null {
  for (const [name, value] of headers) {
    const key = name.toLowerCase();
    if (!key.startsWith("retry-after") && !key.startsWith("x-ratelimit-reset")) continue;
    const secs = Number(value);
    if (Number.isFinite(secs) && secs >= 0) return Math.ceil(secs * 1000);
    const date = Date.parse(value);
    if (Number.isFinite(date)) return Math.max(0, date - now);
  }
  return null;
}
