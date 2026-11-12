import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/vault", () => ({ getVaultIndexSafe: vi.fn(async () => null) }));
import { n8nOverview, n8nInstanceSummary } from "@/server/ops";
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
      return Response.json({ data: [{ id: String(page), name: "Fluxo", active: true, updatedAt: "2026-10-28T12:00:00Z" }], nextCursor: `+cursor/${page}=` });
    });
    vi.stubGlobal("fetch", request);
    const result = await n8nOverview();
    expect(result.instances[0]).toMatchObject({ ok: true, workflowsPartial: true });
    expect(result.instances[0].workflows).toHaveLength(10);
    expect(request.mock.calls.filter(([url]) => url.includes("/workflows?"))[1][0]).toContain("cursor=%2Bcursor%2F1%3D");
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

const configure = () => vi.stubEnv("N8N_INSTANCES", JSON.stringify([{ name: "VPS-03", url: "https://n8nb.example", apiKey: "secret-key" }]));
const workflow = (id = "flow") => ({ id, name: "Fluxo", active: true, updatedAt: "2026-11-10T12:00:00Z" });
const execution = { id: "run", workflowId: "flow", startedAt: "2026-11-10T12:00:00Z", stoppedAt: null };

it("mantém workflows quando a consulta de execuções falha, sem declarar zero falhas", async () => {
  configure();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("/executions?") ? new Response(null, { status: 403 }) : Response.json({ data: [workflow()] })));
  const instance = (await n8nOverview()).instances[0];
  expect(instance).toMatchObject({ ok: false, workflowsAvailable: true, executionsAvailable: false, executionsError: expect.stringContaining("403") });
  expect(instance.workflows).toHaveLength(1);
  expect(n8nInstanceSummary(instance)).toContain("ausência de falhas não confirmada");
  expect(n8nInstanceSummary(instance)).not.toContain("0 falhas");
});

it("mantém falhas recebidas quando o inventário está indisponível", async () => {
  configure();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("/workflows?") ? new Response(null, { status: 500 }) : Response.json({ data: [execution], nextCursor: "more" })));
  const instance = (await n8nOverview()).instances[0];
  expect(instance).toMatchObject({ ok: false, workflowsAvailable: false, executionsAvailable: true, errorsPartial: true });
  expect(instance.errors).toHaveLength(1);
  expect(n8nInstanceSummary(instance)).toContain("inventário de workflows indisponível");
  expect(n8nInstanceSummary(instance)).toContain("há mais páginas");
});

it("preserva páginas válidas antes de uma falha e não duplica workflows entre páginas", async () => {
  configure();
  let page = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.includes("/executions?")) return Response.json({ data: [] });
    if (++page === 3) throw new Error("secret-key");
    return Response.json({ data: [workflow()], nextCursor: String(page) });
  }));
  const instance = (await n8nOverview()).instances[0];
  expect(instance).toMatchObject({ ok: false, workflowsAvailable: false, workflowsPartial: true, executionsAvailable: true });
  expect(instance.workflows).toHaveLength(1);
  expect(JSON.stringify(instance)).not.toContain("secret-key");
});

it.each([null, {}, { data: [{ ...workflow(), active: "false" }] }, { data: [], nextCursor: 123 }])("recusa inventário malformado: %j", async payload => {
  configure();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json(url.includes("/executions?") ? { data: [] } : payload)));
  expect((await n8nOverview()).instances[0]).toMatchObject({ ok: false, workflowsAvailable: false, executionsAvailable: true });
});

it.each([null, {}, { data: [{ ...execution, startedAt: "invalid" }] }, { data: [], nextCursor: true }])("recusa execuções malformadas: %j", async payload => {
  configure();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json(url.includes("/workflows?") ? { data: [] } : payload)));
  const instance = (await n8nOverview()).instances[0];
  expect(instance).toMatchObject({ ok: false, workflowsAvailable: true, executionsAvailable: false });
  expect(n8nInstanceSummary(instance)).not.toContain("0 falhas");
});

it("reconhece todos os IDs da célula e compara somente o runtime correspondente", async () => {
  vi.stubEnv("N8N_INSTANCES", JSON.stringify([{ name: "Oracle", url: "https://n8nb.example", apiKey: "secret-key" }]));
  const body = "## n8n VPS-03 (`n8nb.example`)\n| Automação | ID | Função | Execução |\n|---|---|---|---|\n| Dupla | `first`, `second_id` | Testa | Diário |\n## OpenClaw VPS-03\n| Rotina | ID | Função | Execução |\n|---|---|---|---|\n| Outro runtime | `third` | Outro | Diário |";
  vi.mocked(getVaultIndexSafe).mockResolvedValueOnce({ resolve: () => "nota", notes: new Map([["nota", { body }]]) } as never);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json({ data: url.includes("/workflows?") ? [workflow("first"), workflow("second_id"), workflow("third")] : [] })));
  const overview = await n8nOverview();
  expect(overview.documented[0]).toMatchObject({ id: "first", ids: ["first", "second_id"] });
  expect(overview.instances[0].workflows.map(w => w.documented?.name ?? null)).toEqual(["Dupla", "Dupla", null]);
});
