import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireAuth: vi.fn(), parse: vi.fn(), authorize: vi.fn(), denied: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/server/mcp-oauth", () => ({ OAuthError: class extends Error {}, parseAuthorization: mocks.parse, authorizeOAuth: mocks.authorize, authorizationRedirect: mocks.denied }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
import { consentOAuth } from "@/app/oauth/authorize/actions";
describe("consentimento OAuth", () => {
  beforeEach(() => vi.resetAllMocks());
  it("não cria acesso nem processa o pedido sem sessão", async () => {
    mocks.requireAuth.mockRejectedValue(new Error("sem sessão"));
    const form = new FormData(); form.set("decision", "allow"); form.append("scope", "admin");
    await expect(consentOAuth("client_id=x", form)).rejects.toThrow("sem sessão");
    expect(mocks.parse).not.toHaveBeenCalled(); expect(mocks.authorize).not.toHaveBeenCalled();
  });
  it("consentimento negado retorna erro sem criar credenciais", async () => {
    mocks.parse.mockResolvedValue({ clientId: "x" }); mocks.denied.mockReturnValue("https://chatgpt.com/cancelado");
    const form = new FormData(); form.set("decision", "deny");
    await expect(consentOAuth("client_id=x", form)).rejects.toThrow("redirect:https://chatgpt.com/cancelado");
    expect(mocks.denied).toHaveBeenCalledWith({ clientId: "x" }, { error: "access_denied" });
    expect(mocks.authorize).not.toHaveBeenCalled();
  });
  it("revalida pedido e usa somente as permissões selecionadas", async () => {
    mocks.parse.mockResolvedValue({ clientId: "x" }); mocks.authorize.mockResolvedValue("https://chatgpt.com/codigo");
    const form = new FormData(); form.set("decision", "allow"); form.append("scope", "status");
    await expect(consentOAuth("client_id=x", form)).rejects.toThrow("redirect:https://chatgpt.com/codigo");
    expect(mocks.requireAuth).toHaveBeenCalledOnce();
    expect(mocks.authorize).toHaveBeenCalledWith({ clientId: "x" }, ["status"]);
  });
});
