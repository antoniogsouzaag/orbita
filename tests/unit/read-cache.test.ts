import { afterEach, expect, it, vi } from "vitest";
import { createReadCache } from "@/lib/read-cache";

afterEach(() => vi.useRealTimers());
it("compartilha consultas simultâneas e expira sem renovar a idade na leitura", async () => {
  vi.useFakeTimers();
  const cache = createReadCache(60_000);
  const load = vi.fn(async () => ({ count: 0 }));
  const [a, b] = await Promise.all([cache.read("empresa:app", load), cache.read("empresa:app", load)]);
  expect(a).toBe(b); expect(load).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(59_999); await cache.read("empresa:app", load);
  expect(load).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1); await cache.read("empresa:app", load);
  expect(load).toHaveBeenCalledTimes(2);
});
it("isola chaves, permite atualização manual e não guarda falhas como zero", async () => {
  const cache = createReadCache(60_000, 2);
  const load = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(0);
  await expect(cache.read("a", load)).rejects.toThrow("offline");
  expect(await cache.read("a", load)).toBe(0);
  await cache.read("b", load); expect(load).toHaveBeenCalledTimes(3);
  cache.clear(); await cache.read("a", load); expect(load).toHaveBeenCalledTimes(4);
});
it("limita memória e uma falha antiga não apaga uma consulta nova", async () => {
  const cache = createReadCache(60_000, 1);
  let fail!: (error: Error) => void;
  const old = cache.read("a", () => new Promise((_, reject) => { fail = reject; }));
  await Promise.resolve();
  await cache.read("b", async () => 2);
  const fresh = vi.fn(async () => 3);
  await cache.read("a", fresh);
  fail(new Error("old")); await expect(old).rejects.toThrow("old");
  expect(await cache.read("a", fresh)).toBe(3); expect(fresh).toHaveBeenCalledTimes(1);
});
