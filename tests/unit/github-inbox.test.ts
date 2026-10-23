import { afterEach, describe, expect, it, vi } from "vitest";
import { githubInbox, githubInboxConfig } from "@/server/github-inbox";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function credentials(inbox = "", general = "", vault = "") {
  vi.stubEnv("GITHUB_INBOX_TOKEN", inbox);
  vi.stubEnv("GITHUB_TOKEN", general);
  vi.stubEnv("VAULT_GITHUB_TOKEN", vault);
}

describe("GitHub operacional", () => {
  it("reutiliza o token Knowledge apenas como reserva e não devolve o segredo", async () => {
    credentials("", "", "vault-secret-never-in-ui");
    const request = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.headers).toMatchObject({ authorization: "Bearer vault-secret-never-in-ui" });
      return Response.json({ items: [], total_count: 0 });
    });
    vi.stubGlobal("fetch", request);
    const data = await githubInbox({ force: true });
    expect(data).toMatchObject({ configured: true, credential: "VAULT_GITHUB_TOKEN", total: 0, error: null });
    expect(data.warning).toContain("não oferece visão de toda a organização");
    expect(JSON.stringify(data)).not.toContain("vault-secret-never-in-ui");
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("prioriza o token dedicado sobre o geral e o do vault", () => {
    credentials("dedicated", "general", "vault");
    expect(githubInboxConfig().credential).toBe("GITHUB_INBOX_TOKEN");
    credentials("", "general", "vault");
    expect(githubInboxConfig().credential).toBe("GITHUB_TOKEN");
  });

  it("não consulta a rede sem credencial", async () => {
    credentials();
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    expect(await githubInbox()).toMatchObject({ configured: false, checkedAt: null });
    expect(request).not.toHaveBeenCalled();
  });

  it("informa truncamento e recusa sem transformar erro em fila vazia", async () => {
    credentials("dedicated");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ items: [], total_count: 125, incomplete_results: true })));
    expect(await githubInbox({ force: true })).toMatchObject({ total: 250, truncated: true });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 401 })));
    expect(await githubInbox({ force: true })).toMatchObject({ configured: true, error: "Token do GitHub inválido ou expirado." });
  });

  it("não vaza credenciais em erros do transporte", async () => {
    credentials("dedicated-secret");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("https://dedicated-secret@api.github.com"); }));
    const data = await githubInbox({ force: true });
    expect(data.error).toContain("Não foi possível");
    expect(JSON.stringify(data)).not.toContain("dedicated-secret");
  });
});
