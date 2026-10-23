import { afterEach, describe, expect, it, vi } from "vitest";
import { AGENT_MANUAL_VERSION, agentManualMarkdown } from "@/lib/agent-handbook";
import { GET } from "@/app/api/docs/agentes/route";
import { isAuthenticated, tokenMatches } from "@/lib/auth";
import { verifyAgentToken } from "@/server/agents";

vi.mock("@/lib/auth", () => ({ isAuthenticated: vi.fn(async () => false), tokenMatches: vi.fn(() => false) }));
vi.mock("@/server/agents", () => ({ verifyAgentToken: vi.fn(async () => null) }));
afterEach(() => vi.clearAllMocks());

describe("manual canônico autenticado", () => {
  it("recusa acesso anônimo e não entrega o contrato como cache público", async () => {
    const res = await GET(new Request("https://orb.example/api/docs/agentes"));
    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain(AGENT_MANUAL_VERSION);
  });
  it("entrega a fonte única para um token válido de agente", async () => {
    vi.mocked(verifyAgentToken).mockResolvedValueOnce({ id: "one", name: "Agente", scopes: ["status"] });
    const res = await GET(new Request("https://orb.example/api/docs/agentes", { headers: { authorization: "Bearer orb_example" } }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.text()).toBe(agentManualMarkdown());
  });
  it("aceita sessão do proprietário", async () => {
    vi.mocked(isAuthenticated).mockResolvedValueOnce(true);
    expect((await GET(new Request("https://orb.example/api/docs/agentes"))).status).toBe(200);
  });
  it("aceita token de contexto e recusa token revogado", async () => {
    vi.mocked(tokenMatches).mockReturnValueOnce(true);
    expect((await GET(new Request("https://orb.example/api/docs/agentes"))).status).toBe(200);
    expect((await GET(new Request("https://orb.example/api/docs/agentes", { headers: { authorization: "Bearer orb_revoked" } }))).status).toBe(401);
  });
});
