/** Cache curto em memória: compartilha leituras simultâneas, nunca guarda falhas. */
export function createReadCache(ttlMs: number, limit = 100) {
  const entries = new Map<string, { expires: number; value: Promise<unknown> }>();
  return {
    clear() { entries.clear(); },
    read<T>(key: string, load: () => Promise<T>): Promise<T> {
      const hit = entries.get(key);
      if (hit && hit.expires > Date.now()) return hit.value as Promise<T>;
      entries.delete(key);
      if (entries.size >= limit) entries.delete(entries.keys().next().value!);
      const entry = { expires: Infinity, value: Promise.resolve().then(load) as Promise<unknown> };
      entries.set(key, entry);
      entry.value.then(() => { entry.expires = Date.now() + ttlMs; }, () => {
        if (entries.get(key) === entry) entries.delete(key);
      });
      return entry.value as Promise<T>;
    },
  };
}
