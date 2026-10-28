import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/vault", () => ({ getVaultIndexSafe: vi.fn(async () => null) }));
import { n8nOverview } from "@/server/ops";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("cobertura de consultas n8n", () => {
  it("codifica o cursor e sinaliza inventário parcial após o limite de páginas", async () => {
    vi.stubEnv("N8N_INSTANCES", JSON.stringify([{ name: "vps", url: "https://n8n.example", apiKey: "secret-key" }]));
    let page = 0;
    const request = vi.fn(async (url: string) => {
      if (url.includes("/executions?")) return Response.json({ data: [] });
      page++;
      return Response.json({ data: [{ id: String(page), name: "Fluxo", active: true, updatedAt: "2026-10-28" }], nextCursor: `+cursor/${page}=` });
    });
    vi.stubGlobal("fetch", request);
    const result = await n8nOverview();
    expect(result.instances[0]).toMatchObject({ ok: true, workflowsPartial: true });
    expect(result.instances[0].workflows).toHaveLength(10);
    expect(request.mock.calls[1][0]).toContain("cursor=%2Bcursor%2F1%3D");
    expect(request).toHaveBeenCalledTimes(11);
  });

  it("interrompe cursor repetido e não mascara truncamento", async () => {
    vi.stubEnv("N8N_INSTANCES", JSON.stringify([{ name: "vps", url: "https://n8n.example", apiKey: "secret-key" }]));
    vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json(url.includes("/executions?") ? { data: [] } : { data: [], nextCursor: "same" })));
    expect((await n8nOverview()).instances[0]).toMatchObject({ ok: true, workflowsPartial: true });
  });

  it("não propaga erro de transporte com segredo ou URL aos agentes", async () => {
    vi.stubEnv("N8N_INSTANCES", JSON.stringify([{ name: "vps", url: "https://n8n.example", apiKey: "secret-key" }]));
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("secret-key in upstream transport"); }));
    const result = await n8nOverview();
    expect(result.instances[0]).toMatchObject({ ok: false, error: expect.stringContaining("Não foi possível") });
    expect(result.instances[0].error).not.toContain("secret-key");
  });
});
