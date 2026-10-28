import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/vault", () => ({ getVaultIndexSafe: vi.fn(async () => null) }));
import { n8nOverview } from "@/server/ops";
import { getVaultIndexSafe } from "@/server/vault";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("cobertura de consultas n8n", () => {
  it("distingue vault indisponível, ficha sem tabelas reconhecidas e inventário lido", async () => {
    vi.stubEnv("N8N_INSTANCES", "[]");
    expect((await n8nOverview()).documentationAvailable).toBe(false);
    const index = (body: string) => ({ resolve: () => "nota", notes: new Map([["nota", { body }]]) });
    vi.mocked(getVaultIndexSafe).mockResolvedValueOnce(index("# Ficha sem inventário") as never);
    expect((await n8nOverview()).documentationAvailable).toBe(false);
    vi.mocked(getVaultIndexSafe).mockResolvedValueOnce(index("| Automação | ID | Função | Execução |\n|---|---|---|---|\n| Monitor | monitor123 | Verifica | Diário |") as never);
    const loaded = await n8nOverview();
    expect(loaded.documentationAvailable).toBe(true);
    expect(loaded.documented).toHaveLength(1);
  });
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
