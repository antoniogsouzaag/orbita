import { afterEach, describe, expect, it, vi } from "vitest";
import { githubInbox, githubInboxConfig } from "@/server/github-inbox";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function credentials(inbox = "", general = "", vault = "") {
  vi.stubEnv("GITHUB_INBOX_TOKEN", inbox);
  vi.stubEnv("GITHUB_TOKEN", general);
  vi.stubEnv("VAULT_GITHUB_TOKEN", vault);
}

describe("GitHub operacional", () => {
  it("consulta execução e decisão sem esconder aprovadas ainda abertas", async () => {
    credentials("fixture-triage");
    const request = vi.fn(async (url: string) => {
      const q = new URL(url).searchParams.get("q")!;
      if (q.includes("is:pr")) return Response.json({items:[],total_count:0});
      expect(q).toContain("label:proposta,execucao,decisao");
      expect(q).not.toContain("-label:aprovado");
      return Response.json({items:[
        {title:"Correção",html_url:"https://github.com/org/app/issues/1",number:1,updated_at:"2026-10-24",repository_url:"https://api.github.com/repos/org/app",labels:[{name:"execucao"},{name:"bloqueado"}]},
        {title:"Mudança de preço",html_url:"https://github.com/org/app/issues/2",number:2,updated_at:"2026-10-24",repository_url:"https://api.github.com/repos/org/app",labels:[{name:"decisao"}]},
        {title:"Proposta legada",html_url:"https://github.com/org/app/issues/3",number:3,updated_at:"2026-10-24",repository_url:"https://api.github.com/repos/org/app",labels:[{name:"proposta"}]}
      ],total_count:3});
    });
    vi.stubGlobal("fetch",request);
    const result = await githubInbox({force:true});
    expect(result.total).toBe(3);
    expect(result.items.map(i => i.stage)).toEqual(["execution","decision","triage"]);
    expect(result.items[0].blocked).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("preserva a última lista válida quando uma atualização temporariamente falha", async () => {
    credentials("token-for-stale-test");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ items: [{ title: "Revisar", html_url: "https://github.com/org/repo/pull/1", number: 1, updated_at: "2026-10-23", repository_url: "https://api.github.com/repos/org/repo" }], total_count: 1 })));
    const success = await githubInbox({ force: true });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
    const stale = await githubInbox({ force: true });
    expect(stale).toMatchObject({ stale: true, checkedAt: success.checkedAt });
    expect(stale.items).toEqual(success.items);
    expect(stale.error).toContain("GitHub recusou");
    expect(await githubInbox()).toEqual(stale);
    expect(await githubInbox({ force: true })).toEqual(stale);
  });
  it("preserva também uma consulta vazia válida com data antiga e aviso de falha", async () => {
    credentials("empty-snapshot");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ items: [], total_count: 0 })));
    const success = await githubInbox({ force: true });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    const stale = await githubInbox({ force: true });
    expect(stale).toMatchObject({ items: [], total: 0, stale: true, checkedAt: success.checkedAt });
    expect(stale.error).toBeTruthy();
    expect(await githubInbox()).toEqual(stale);
  });

  it.each([401, 403, 422])("não reapresenta dados antigos após recusa de acesso %s", async (status) => {
    credentials(`denied-${status}`);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ items: [{ title: "Revisar", html_url: "https://github.com/org/repo/pull/1", number: 1, updated_at: "2026-10-23", repository_url: "https://api.github.com/repos/org/repo" }], total_count: 1 })));
    expect((await githubInbox({ force: true })).items.length).toBeGreaterThan(0);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status })));
    expect(await githubInbox({ force: true })).toMatchObject({ items: [], error: expect.any(String) });
    expect((await githubInbox()).stale).not.toBe(true);
  });

  it("compartilha uma atualização simultânea entre painel e agentes", async () => {
    credentials("concurrent-refresh");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const request = vi.fn(async () => {
      await gate;
      return Response.json({ items: [], total_count: 0 });
    });
    vi.stubGlobal("fetch", request);
    const first = githubInbox({ force: true });
    const second = githubInbox({ force: true });
    const third = githubInbox();
    expect(request).toHaveBeenCalledTimes(2);
    release();
    const results = await Promise.all([first, second, third]);
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });

  it("não aceita resposta sem contagem como consulta verificada", async () => {
    credentials("invalid-payload");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ items: [] })));
    expect(await githubInbox({ force: true })).toMatchObject({ error: expect.any(String), total: 0 });
  });

  it("retenta após um minuto e limpa a falha quando a fonte se recupera", async () => {
    credentials("retry-window");
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const request = vi.fn(async () => new Response("", { status: 503 }));
    vi.stubGlobal("fetch", request);
    expect((await githubInbox({ force: true })).error).toBeTruthy();
    request.mockImplementation(async () => Response.json({ items: [], total_count: 0 }));
    now.mockReturnValue(1_059_999);
    expect((await githubInbox()).error).toBeTruthy();
    expect(request).toHaveBeenCalledTimes(2);
    now.mockReturnValue(1_060_001);
    expect(await githubInbox()).toMatchObject({ error: null, items: [] });
    expect(request).toHaveBeenCalledTimes(4);
  });

  it("não compartilha respostas de credenciais diferentes", async () => {
    credentials("identity-a");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const request = vi.fn(async (_url: string, init: RequestInit) => {
      const authorization = (init.headers as Record<string, string>).authorization;
      if (authorization === "Bearer identity-a") await gate;
      return Response.json({ items: [], total_count: authorization === "Bearer identity-a" ? 1 : 2 });
    });
    vi.stubGlobal("fetch", request);
    const first = githubInbox({ force: true });
    credentials("identity-b");
    expect((await githubInbox({ force: true })).total).toBe(4);
    release();
    expect((await first).total).toBe(2);
    expect(request).toHaveBeenCalledTimes(4);
  });

  it("não aceita mensagem de transporte com prefixo parecido com erro seguro", async () => {
    credentials("prefix-error");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("O GitHub secret-in-transport"); }));
    expect(JSON.stringify(await githubInbox({ force: true }))).not.toContain("secret-in-transport");
  });
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
