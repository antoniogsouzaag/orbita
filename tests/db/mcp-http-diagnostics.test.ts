import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/mcp/route";
import { createAgentToken } from "@/server/agents";
import { POST as tokenEndpoint } from "@/app/api/oauth/token/route";

describe("diagnóstico do transporte MCP", () => {
  it("distingue falha de autenticação e de negociação sem registrar credenciais ou conteúdo", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const token = await createAgentToken("Diagnóstico isolado", ["status"]);
      for (const [authorization, expectedStatus] of [["Bearer invalido", 401], [`Bearer ${token}`, 406]] as const) {
        const response = await POST(new Request("https://orb.aglabs.api.br/api/mcp", {
          method: "POST", headers: { authorization, accept: "application/json", "content-type": "application/json", "x-private": "conteudo-privado" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: { private: "conteudo-privado" } }),
        }));
        expect(response.status).toBe(expectedStatus);
        expect(JSON.parse(info.mock.calls.at(-1)![1])).toMatchObject({ status: expectedStatus, authenticated: expectedStatus !== 401, acceptsJson: true, acceptsEventStream: false });
      }
      const response = await tokenEndpoint(new Request("https://orb.aglabs.api.br/api/oauth/token", {
        method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: "conteudo-privado" }),
      }));
      expect(response.status).toBe(400);
      expect(JSON.parse(info.mock.calls.at(-1)![1])).toEqual({ status: 400, code: "invalid_target" });
      const logged = JSON.stringify(info.mock.calls);
      expect(logged).not.toContain(token);
      expect(logged).not.toContain("conteudo-privado");
      expect(logged).not.toContain("authorization");
    } finally { info.mockRestore(); }
  });
});
