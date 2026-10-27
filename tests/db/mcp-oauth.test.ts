import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { agentTokens, mcpOAuthCodes, mcpOAuthGrants, mcpOAuthRefreshTokens, settings } from "@/db/schema";
import { createAgentToken, revokeAgentToken, updateAgentScopes, verifyAgentToken } from "@/server/agents";
import { allowedRedirect, authorizeOAuth, digest, exchangeOAuthToken, oauthMetadata, oauthOrigin, oauthResource, parseAuthorization, registerOAuthClient, revokeOAuthToken } from "@/server/mcp-oauth";
import { POST as mcp } from "@/app/api/mcp/route";
import { POST as tokenRoute } from "@/app/api/oauth/token/route";
import { POST as registerRoute } from "@/app/api/oauth/register/route";
import { GET as discovery } from "@/app/.well-known/oauth-protected-resource/api/mcp/route";

const callback = "https://chatgpt.com/connector_platform_oauth_redirect";
const verifier = "v".repeat(64);
let sequence = 0;
async function request(scopes = "contexto status") {
  const client = await registerOAuthClient({ client_name: `Teste ${++sequence}`, redirect_uris: [callback] });
  const params = new URLSearchParams({ client_id: client.client_id, redirect_uri: callback, response_type: "code", resource: oauthResource(), code_challenge_method: "S256", code_challenge: createHash("sha256").update(verifier).digest("base64url"), scope: scopes, state: "estado-original" });
  return { params, client, auth: await parseAuthorization(params) };
}
async function connection(scopes = "contexto status") {
  const req = await request(scopes);
  const redirect = new URL(await authorizeOAuth(req.auth, scopes.split(" ")));
  const form = new URLSearchParams({ grant_type: "authorization_code", code: redirect.searchParams.get("code")!, code_verifier: verifier, client_id: req.client.client_id, redirect_uri: callback, resource: oauthResource() });
  const tokens = await exchangeOAuthToken(form);
  const identity = (await verifyAgentToken(tokens.access_token))!;
  const renewal = (refresh = tokens.refresh_token) => new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh, client_id: req.client.client_id, resource: oauthResource() });
  return { ...req, redirect, form, tokens, identity, renewal };
}
describe("OAuth MCP persistente", () => {
  it("publica descoberta e challenge sem expor catálogo anônimo", async () => {
    expect(oauthMetadata()).toMatchObject({ issuer: oauthOrigin(), code_challenge_methods_supported: ["S256"], token_endpoint_auth_methods_supported: ["none"] });
    expect(await (await discovery()).json()).toMatchObject({ resource: oauthResource() });
    const res = await mcp(new Request(oauthResource(), { method: "POST" }));
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("/.well-known/oauth-protected-resource/api/mcp");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
  it("restringe callbacks, método e metadados do cliente", async () => {
    for (const uri of [callback, "https://chatgpt.com/connector/oauth/abc_123", "http://127.0.0.1:4321/callback"]) expect(allowedRedirect(uri)).toBe(true);
    for (const uri of ["https://evil.test/callback", "https://chatgpt.com.evil.test/connector_platform_oauth_redirect", `${callback}?next=x`, `${callback}#secret`, "http://169.254.169.254/callback", "https://user@chatgpt.com/connector_platform_oauth_redirect"]) expect(allowedRedirect(uri)).toBe(false);
    await expect(registerOAuthClient({ redirect_uris: ["https://evil.test"] })).rejects.toMatchObject({ code: "invalid_client_metadata" });
    await expect(registerOAuthClient({ redirect_uris: [callback], token_endpoint_auth_method: "client_secret_post" })).rejects.toMatchObject({ code: "invalid_client_metadata" });
    expect((await registerRoute(new Request("http://localhost/api/oauth/register", { method: "POST", body: "{" }))).status).toBe(400);
  });
  it("valida cliente, callback, resource, escopos e PKCE antes do consentimento", async () => {
    const { params } = await request();
    for (const [key, value, code] of [["redirect_uri", "https://evil.test", "invalid_request"], ["client_id", "outro", "invalid_request"], ["resource", "https://evil.test", "invalid_target"], ["scope", "superadmin", "invalid_scope"], ["code_challenge_method", "plain", "invalid_request"], ["code_challenge", "curto", "invalid_request"]]) {
      const bad = new URLSearchParams(params); bad.set(key, value);
      await expect(parseAuthorization(bad)).rejects.toMatchObject({ code });
    }
    const repeated = new URLSearchParams(params); repeated.append("scope", "admin");
    await expect(parseAuthorization(repeated)).rejects.toMatchObject({ code: "invalid_request" });
    const { auth } = await request();
    await expect(authorizeOAuth(auth, ["admin"])).rejects.toMatchObject({ code: "invalid_scope" });
    await expect(authorizeOAuth(auth, [])).rejects.toMatchObject({ code: "invalid_scope" });
  });
  it("emite código de uso único e tokens com hash, state e issuer corretos", async () => {
    const c = await connection();
    expect(c.redirect.searchParams.get("state")).toBe("estado-original");
    expect(c.redirect.searchParams.get("iss")).toBe(oauthOrigin());
    expect(c.identity.scopes).toEqual(["contexto", "status"]);
    const db = await getDb();
    const [grant] = await db.select().from(mcpOAuthGrants).where(eq(mcpOAuthGrants.accessHash, digest(c.tokens.access_token)));
    expect(JSON.stringify(grant)).not.toContain(c.tokens.access_token);
    const [storedRefresh] = await db.select().from(mcpOAuthRefreshTokens).where(eq(mcpOAuthRefreshTokens.grantId, grant.id));
    expect(storedRefresh.hash).toBe(digest(c.tokens.refresh_token));
    await expect(exchangeOAuthToken(c.form)).rejects.toMatchObject({ code: "invalid_grant" });
    const response = await mcp(new Request(oauthResource(), { method: "POST", headers: { authorization: `Bearer ${c.tokens.access_token}`, "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.tools.map((t: {name: string}) => t.name)).toContain("documentacao");
    expect(body.result.tools.map((t: {name: string}) => t.name)).not.toContain("contexto_pessoal");
  });
  it("recusa troca com verifier, cliente, callback, resource incorretos e código expirado", async () => {
    const c = await request();
    const url = new URL(await authorizeOAuth(c.auth, ["status"]));
    const form = new URLSearchParams({ grant_type: "authorization_code", code: url.searchParams.get("code")!, code_verifier: verifier, client_id: c.client.client_id, redirect_uri: callback, resource: oauthResource() });
    for (const [key, value] of [["code_verifier", "x".repeat(64)], ["client_id", "other"], ["redirect_uri", "http://localhost:1/callback"], ["resource", "https://evil.test"]]) {
      const bad = new URLSearchParams(form); bad.set(key, value);
      await expect(exchangeOAuthToken(bad)).rejects.toBeDefined();
    }
    const db = await getDb();
    await db.update(mcpOAuthCodes).set({ expiresAt: new Date(0) }).where(eq(mcpOAuthCodes.hash, digest(form.get("code")!)));
    await expect(exchangeOAuthToken(form)).rejects.toMatchObject({ code: "invalid_grant" });
  });
  it("renova com rotação e revoga família quando um refresh é reutilizado", async () => {
    const c = await connection();
    const next = await exchangeOAuthToken(c.renewal());
    expect(next.refresh_token).not.toBe(c.tokens.refresh_token);
    expect(await verifyAgentToken(c.tokens.access_token)).toBeNull();
    expect(await verifyAgentToken(next.access_token)).not.toBeNull();
    await expect(exchangeOAuthToken(c.renewal())).rejects.toMatchObject({ code: "invalid_grant" });
    expect(await verifyAgentToken(next.access_token)).toBeNull();
    await expect(exchangeOAuthToken(c.renewal(next.refresh_token))).rejects.toMatchObject({ code: "invalid_grant" });
  });
  it("isola cliente, limita scope e impede renovação de acesso revogado", async () => {
    const c = await connection();
    const other = c.renewal(); other.set("client_id", "other");
    await expect(exchangeOAuthToken(other)).rejects.toMatchObject({ code: "invalid_grant" });
    const expanded = c.renewal(); expanded.set("scope", "admin");
    await expect(exchangeOAuthToken(expanded)).rejects.toMatchObject({ code: "invalid_scope" });
    expect(await verifyAgentToken(c.tokens.access_token)).not.toBeNull();
    await revokeAgentToken(c.identity.id);
    expect(await verifyAgentToken(c.tokens.access_token)).toBeNull();
    await expect(exchangeOAuthToken(c.renewal())).rejects.toMatchObject({ code: "invalid_grant" });
  });
  it("respeita downgrade e não amplia consentimento ao aumentar perfil", async () => {
    const c = await connection("contexto status admin");
    await updateAgentScopes(c.identity.id, ["contexto", "status"]);
    expect((await verifyAgentToken(c.tokens.access_token))!.scopes).toEqual(["contexto", "status"]);
    const read = await connection();
    await updateAgentScopes(read.identity.id, ["admin"]);
    expect((await verifyAgentToken(read.tokens.access_token))!.scopes).toEqual(["contexto", "status"]);
  });
  it("recusa access/refresh expirados e revogação de outro cliente", async () => {
    const c = await connection(); const db = await getDb();
    await revokeOAuthToken(new URLSearchParams({ client_id: "outro", token: c.tokens.refresh_token }));
    expect(await verifyAgentToken(c.tokens.access_token)).not.toBeNull();
    await db.update(mcpOAuthGrants).set({ accessExpiresAt: new Date(0) }).where(eq(mcpOAuthGrants.accessHash, digest(c.tokens.access_token)));
    expect(await verifyAgentToken(c.tokens.access_token)).toBeNull();
    await db.update(mcpOAuthRefreshTokens).set({ expiresAt: new Date(0) }).where(eq(mcpOAuthRefreshTokens.hash, digest(c.tokens.refresh_token)));
    await expect(exchangeOAuthToken(c.renewal())).rejects.toMatchObject({ code: "invalid_grant" });
  });
  it("revoga via endpoint lógico e mantém tokens Bearer anteriores", async () => {
    const c = await connection();
    await revokeOAuthToken(new URLSearchParams({ client_id: c.client.client_id, token: c.tokens.access_token }));
    expect(await verifyAgentToken(c.tokens.access_token)).toBeNull();
    await expect(exchangeOAuthToken(c.renewal())).rejects.toMatchObject({ code: "invalid_grant" });
    const legacy = await createAgentToken("Legado", ["status"]);
    expect((await verifyAgentToken(legacy))!.scopes).toEqual(["status"]);
    const res = await tokenRoute(new Request("http://localhost/api/oauth/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials&resource=" + encodeURIComponent(oauthResource()) }));
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ error: "unsupported_grant_type" });
    const [agent] = await (await getDb()).select().from(agentTokens).where(eq(agentTokens.id, c.identity.id));
    expect(agent.prefix).toBe("OAuth");
    expect(agent.revoked).toBe(true);
  });
  it("consome o código apenas uma vez sob concorrência", async () => {
    const req = await request();
    const url = new URL(await authorizeOAuth(req.auth, ["status"]));
    const form = new URLSearchParams({ grant_type: "authorization_code", code: url.searchParams.get("code")!, code_verifier: verifier, client_id: req.client.client_id, redirect_uri: callback, resource: oauthResource() });
    const results = await Promise.allSettled([exchangeOAuthToken(form), exchangeOAuthToken(form)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
  });
  it("limita novos cadastros persistentemente sem bloquear cliente já cadastrado", async () => {
    const input = { client_name: `Limite ${++sequence}`, redirect_uris: [callback] };
    const registered = await registerOAuthClient(input);
    const db = await getDb();
    await db.insert(settings).values({ key: "mcp-oauth-dcr-rate", value: { window: Math.floor(Date.now() / 3_600_000), count: 100 } }).onConflictDoUpdate({ target: settings.key, set: { value: { window: Math.floor(Date.now() / 3_600_000), count: 100 } } });
    try {
      await expect(registerOAuthClient({ ...input, client_name: "Outro cadastro bloqueado" })).rejects.toMatchObject({ status: 429 });
      expect((await registerOAuthClient(input)).client_id).toBe(registered.client_id);
    } finally { await db.delete(settings).where(eq(settings.key, "mcp-oauth-dcr-rate")); }
  });
});
