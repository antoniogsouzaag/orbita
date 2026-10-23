import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
import { socialOverview } from "@/server/social";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("Postiz somente consulta", () => {
  it("consulta só o canal escolhido e preserva todos os canais para seleção", async () => {
    vi.stubEnv("POSTIZ_API_URL", "https://postiz.example/api/public/v1");
    vi.stubEnv("POSTIZ_API_KEY", "private-key");
    const request = vi.fn(async (url: string) => Response.json(url.endsWith("/integrations") ? [
      { id: "a", name: "Primeiro", identifier: "instagram" },
      { id: "b", name: "Segundo", identifier: "youtube" },
    ] : []));
    vi.stubGlobal("fetch", request);
    const result = await socialOverview("b");
    expect(result.available).toHaveLength(2);
    expect(result.channels).toHaveLength(1);
    expect(result.channels[0].id).toBe("b");
    expect(request.mock.calls.map(([url]) => url)).toEqual(["https://postiz.example/api/public/v1/integrations", "https://postiz.example/api/public/v1/analytics/b?date=7"]);
  });
  it("consulta séries sem somar seguidores nem expor a chave", async () => {
    vi.stubEnv("POSTIZ_API_URL", "https://postiz.example/api/public/v1");
    vi.stubEnv("POSTIZ_API_KEY", "private-key");
    const request = vi.fn(async (url: string) => Response.json(url.endsWith("/integrations") ? [{ id: "canal", name: "AG LABS", identifier: "instagram" }] : [{ label: "Followers", data: [{ date: "2026-10-22", total: "120" }], percentageChange: 2 }]));
    vi.stubGlobal("fetch", request);
    const result = await socialOverview();
    expect(result.channels[0].metrics[0].data[0].total).toBe("120");
    expect(JSON.stringify(result)).not.toContain("private-key");
    expect(request.mock.calls.map(([url]) => url)).toEqual(["https://postiz.example/api/public/v1/integrations", "https://postiz.example/api/public/v1/analytics/canal?date=7"]);
  });
  it("uma falha do provedor não vira resultado zero", async () => {
    vi.stubEnv("POSTIZ_API_URL", "https://postiz.example/api/public/v1");
    vi.stubEnv("POSTIZ_API_KEY", "private-key");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("private-key"); }));
    const result = await socialOverview();
    expect(result.error).toBeTruthy();
    expect(JSON.stringify(result)).not.toContain("private-key");
  });
});
