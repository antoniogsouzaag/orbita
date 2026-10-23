import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
import { socialOverview, socialPanelUrl } from "@/server/social";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("Postiz somente consulta", () => {
  it("seleciona todos os canais da entidade e consulta somente seu perfil ativo", async () => {
    vi.stubEnv("POSTIZ_API_URL", "https://postiz.example/api/public/v1");
    vi.stubEnv("POSTIZ_API_KEY", "private-key");
    const group = "66f42ad3-dd35-40fa-a261-d632f680e18e";
    const request = vi.fn(async (url: string) => Response.json(url.endsWith("/integrations") ? [
      { id: "unrelated", name: "Barberias", identifier: "youtube" },
      { id: "barber", name: "Barberro", identifier: "instagram", customer: { id: group, name: "Barberro" } },
      { id: "facebook", name: "Barber PRO", identifier: "facebook", customer: { id: group, name: "Barberias" } },
    ] : []));
    vi.stubGlobal("fetch", request);
    const result = await socialOverview(undefined, 7, true, "barberias");
    expect(result.entityId).toBe(group);
    expect(result.channels[0].id).toBe("barber");
    expect(result.available).toHaveLength(3);
    expect(request.mock.calls.at(-1)?.[0]).toContain("/analytics/barber?");
  });
  it("não consulta outro negócio quando uma entidade não tem canais", async () => {
    vi.stubEnv("POSTIZ_API_URL", "https://postiz.example/api/public/v1");
    vi.stubEnv("POSTIZ_API_KEY", "private-key");
    const request = vi.fn(async () => Response.json([{ id: "real", name: "Real", identifier: "youtube" }]));
    vi.stubGlobal("fetch", request);
    expect(await socialOverview(undefined, 7, true, "barberias")).toMatchObject({ channels: [], error: expect.stringContaining("Nenhum canal") });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("link do painel não transporta credenciais da URL", () => {
    vi.stubEnv("POSTIZ_API_URL", "https://user:private@postiz.example/api/public/v1");
    expect(socialPanelUrl()).toBeNull();
  });
  it("aceita pontos numéricos reais do Instagram e mantém o grupo explícito", async () => {
    vi.stubEnv("POSTIZ_API_URL", "https://postiz.example/api/public/v1");
    vi.stubEnv("POSTIZ_API_KEY", "private-key");
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      expect(init.headers).toMatchObject({ "user-agent": "orbita" });
      return Response.json(url.endsWith("/integrations") ? [{ id: "barber", name: "BARBER PRO", identifier: "instagram-standalone", customer: { id: "explicit", name: "Barberias" } }] : [{ label: "Follower Count", percentageChange: 5, data: [{ date: "2026-10-23", total: 3 }] }]);
    }));
    const result = await socialOverview("barber", 30, true);
    expect(result.channels[0]).toMatchObject({ error: null, customer: { id: "explicit" }, metrics: [{ data: [{ total: "3" }] }] });
  });
  it("não transforma canal inválido em métricas de outro canal", async () => {
    vi.stubEnv("POSTIZ_API_URL", "https://postiz.example/api/public/v1");
    vi.stubEnv("POSTIZ_API_KEY", "private-key");
    const request = vi.fn(async () => Response.json([{ id: "real", name: "Real", identifier: "youtube" }]));
    vi.stubGlobal("fetch", request);
    expect(await socialOverview("apagado")).toMatchObject({ channels: [], error: expect.stringContaining("não está mais disponível") });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("diferencia limite da API e não impede uma nova tentativa", async () => {
    vi.stubEnv("POSTIZ_API_URL", "https://postiz.example/api/public/v1");
    vi.stubEnv("POSTIZ_API_KEY", "private-key");
    let limited = true;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/integrations") ? Response.json([{ id: "a", name: "A", identifier: "instagram" }]) : limited ? new Response("", { status: 429 }) : Response.json([])));
    expect((await socialOverview("a")).channels[0].error).toContain("HTTP 429");
    limited = false;
    expect((await socialOverview("a", 7, true)).channels[0].error).toBeNull();
  });
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
