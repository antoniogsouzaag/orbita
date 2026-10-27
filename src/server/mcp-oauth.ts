import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { AGENT_SCOPES, agentTokens, mcpOAuthClients as clients, mcpOAuthCodes as codes, mcpOAuthGrants as grants, mcpOAuthRefreshTokens as refreshTokens, settings, type AgentScope } from "@/db/schema";
import type { AgentIdentity } from "./agents";

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const opaque = (prefix: string) => `${prefix}${randomBytes(32).toString("base64url")}`;
const expires = (seconds: number) => new Date(Date.now() + seconds * 1000);
const ACCESS_SECONDS = 3600;
const REFRESH_SECONDS = 30 * 86400;

export class OAuthError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
const invalid = () => new OAuthError("invalid_grant", "Credencial inválida, expirada ou revogada. Conecte novamente.");

/** Nunca deriva issuer/resource do Host ou de headers encaminhados pelo cliente. */
export function oauthOrigin() {
  const url = new URL(process.env.ORBITA_PUBLIC_URL || "https://orb.aglabs.api.br");
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) throw new Error("ORBITA_PUBLIC_URL deve ser uma origem HTTPS.");
  return url.origin;
}
export const oauthResource = () => `${oauthOrigin()}/api/mcp`;
export function oauthMetadata() {
  const origin = oauthOrigin();
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    revocation_endpoint: `${origin}/api/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [...AGENT_SCOPES],
    authorization_response_iss_parameter_supported: true,
  };
}
export function protectedMetadata() {
  return { resource: oauthResource(), authorization_servers: [oauthOrigin()], scopes_supported: [...AGENT_SCOPES], bearer_methods_supported: ["header"] };
}
export function oauthChallenge() {
  return `Bearer resource_metadata="${oauthOrigin()}/.well-known/oauth-protected-resource/api/mcp"`;
}

/** DCR restrito aos callbacks OpenAI e ao callback local do Codex. Sem fetch/SSRF. */
export function allowedRedirect(value: string) {
  try {
    const u = new URL(value);
    if (u.username || u.password || u.hash || u.search) return false;
    if (u.origin === "https://chatgpt.com") return u.pathname === "/connector_platform_oauth_redirect" || /^\/connector\/oauth\/[A-Za-z0-9_-]+$/.test(u.pathname);
    return u.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname) && /^\/callback(?:\/[A-Za-z0-9_-]+)?$/.test(u.pathname);
  } catch { return false; }
}
const ClientSchema = z.object({
  client_name: z.string().trim().min(1).max(80).default("Cliente MCP"),
  redirect_uris: z.array(z.string().max(2048).refine(allowedRedirect)).min(1).max(5),
  token_endpoint_auth_method: z.literal("none").default("none"),
  grant_types: z.array(z.enum(["authorization_code", "refresh_token"])).refine(v => v.includes("authorization_code")).default(["authorization_code", "refresh_token"]),
  response_types: z.array(z.literal("code")).min(1).default(["code"]),
});
export async function registerOAuthClient(input: unknown) {
  const parsed = ClientSchema.safeParse(input);
  if (!parsed.success) throw new OAuthError("invalid_client_metadata", "Informe callbacks ChatGPT ou loopback Codex válidos e autenticação none.");
  const p = parsed.data;
  const db = await getDb();
  // Repetir o cadastro não cria uma linha nova para a mesma configuração.
  const redirects = [...new Set(p.redirect_uris)].sort();
  const id = `orb_client_${digest(JSON.stringify([p.client_name, redirects]))}`;
  const [existing] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, id));
  if (!existing) {
    // Limite persistente e atômico entre instâncias; não confia no IP encaminhado.
    // Cadastros repetidos do mesmo cliente não consomem a cota de novos clientes.
    const window = Math.floor(Date.now() / 3_600_000);
    const [rate] = await db.insert(settings).values({ key: "mcp-oauth-dcr-rate", value: { window, count: 1 } }).onConflictDoUpdate({
      target: settings.key,
      set: { value: sql`case when (${settings.value}->>'window')::bigint = ${window} then jsonb_build_object('window', ${window}::bigint, 'count', least(101, (${settings.value}->>'count')::int + 1)) else jsonb_build_object('window', ${window}::bigint, 'count', 1) end` },
    }).returning({ value: settings.value });
    if ((rate.value as { count: number }).count > 100) throw new OAuthError("temporarily_unavailable", "Limite de novos clientes atingido. Tente na próxima hora.", 429);
  }
  await db.insert(clients).values({ id, name: p.client_name, redirectUris: redirects }).onConflictDoNothing();
  return { ...p, redirect_uris: redirects, client_id: id };
}
export type Authorization = { clientId: string; clientName: string; redirectUri: string; resource: string; challenge: string; state: string; scopes: AgentScope[] };
export async function parseAuthorization(params: URLSearchParams): Promise<Authorization> {
  for (const key of new Set(params.keys())) if (params.getAll(key).length !== 1) throw new OAuthError("invalid_request", "Parâmetro repetido.");
  const clientId = params.get("client_id") ?? "";
  const db = await getDb();
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
  const redirectUri = params.get("redirect_uri") ?? "";
  if (!client || !allowedRedirect(redirectUri) || !client.redirectUris.includes(redirectUri)) throw new OAuthError("invalid_request", "Cliente ou callback não cadastrado.");
  if (params.get("response_type") !== "code" || params.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(params.get("code_challenge") ?? "")) throw new OAuthError("invalid_request", "Esta conexão exige authorization code com PKCE S256.");
  if (params.get("resource") !== oauthResource()) throw new OAuthError("invalid_target", "Recurso MCP inválido.");
  const rawScopes = params.get("scope") || "contexto status";
  const scopes = [...new Set(rawScopes.split(/\s+/))];
  if (!scopes.length || scopes.some(s => !AGENT_SCOPES.includes(s as AgentScope))) throw new OAuthError("invalid_scope", "Permissão desconhecida.");
  const state = params.get("state") ?? "";
  if (state.length > 2048) throw new OAuthError("invalid_request", "State longo demais.");
  return { clientId, clientName: client.name, redirectUri, resource: oauthResource(), challenge: params.get("code_challenge")!, state, scopes: scopes as AgentScope[] };
}
export function authorizationRedirect(auth: Authorization, result: { code: string } | { error: string }) {
  const url = new URL(auth.redirectUri);
  for (const [key, value] of Object.entries(result)) url.searchParams.set(key, value);
  if (auth.state) url.searchParams.set("state", auth.state);
  url.searchParams.set("iss", oauthOrigin());
  return url.href;
}
/** Chamado somente depois do consentimento autenticado. O token legado não é distribuído. */
export async function authorizeOAuth(auth: Authorization, selected: string[]) {
  const scopes = [...new Set(selected)] as AgentScope[];
  if (!scopes.length || scopes.some(s => !auth.scopes.includes(s))) throw new OAuthError("invalid_scope", "Selecione permissões dentre as solicitadas.");
  const db = await getDb();
  const [agent] = await db.insert(agentTokens).values({ name: `${auth.clientName.slice(0, 45)} · OAuth`, tokenHash: digest(opaque("unused_")), prefix: "OAuth", scopes }).returning({ id: agentTokens.id });
  const code = opaque("orb_code_");
  await db.insert(codes).values({ hash: digest(code), clientId: auth.clientId, agentId: agent.id, redirectUri: auth.redirectUri, resource: auth.resource, challenge: auth.challenge, scopes, expiresAt: expires(300) });
  return authorizationRedirect(auth, { code });
}
async function assertAgent(id: string) {
  const db = await getDb();
  const [agent] = await db.select().from(agentTokens).where(and(eq(agentTokens.id, id), eq(agentTokens.revoked, false)));
  if (!agent) throw invalid();
  return agent;
}
function tokenResponse(access: string, refresh: string, scopes: AgentScope[]) {
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_SECONDS, refresh_token: refresh, scope: scopes.join(" ") };
}
export async function exchangeOAuthToken(params: URLSearchParams) {
  for (const key of new Set(params.keys())) if (params.getAll(key).length !== 1) throw new OAuthError("invalid_request", "Parâmetro repetido.");
  const db = await getDb();
  const clientId = params.get("client_id") ?? "";
  const resource = params.get("resource");
  if (resource !== oauthResource()) throw new OAuthError("invalid_target", "Recurso MCP inválido.");
  if (params.has("client_secret")) throw new OAuthError("invalid_client", "Cliente público: use PKCE, sem client secret.");
  const access = opaque("orb_oauth_");
  const refresh = opaque("orb_refresh_");
  if (params.get("grant_type") === "authorization_code") {
    const verifier = params.get("code_verifier") ?? "";
    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) throw invalid();
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    // DELETE RETURNING garante uso único mesmo com instâncias concorrentes/Neon HTTP.
    const [code] = await db.delete(codes).where(and(eq(codes.hash, digest(params.get("code") ?? "")), eq(codes.clientId, clientId), eq(codes.redirectUri, params.get("redirect_uri") ?? ""), eq(codes.resource, resource), eq(codes.challenge, challenge), gt(codes.expiresAt, new Date()))).returning();
    if (!code) throw invalid();
    await assertAgent(code.agentId);
    const [grant] = await db.insert(grants).values({ clientId, agentId: code.agentId, resource, scopes: code.scopes, accessHash: digest(access), accessExpiresAt: expires(ACCESS_SECONDS) }).returning({ id: grants.id });
    await db.insert(refreshTokens).values({ hash: digest(refresh), grantId: grant.id, expiresAt: expires(REFRESH_SECONDS) });
    return tokenResponse(access, refresh, code.scopes);
  }
  if (params.get("grant_type") !== "refresh_token") throw new OAuthError("unsupported_grant_type", "Grant não suportado.");
  const hash = digest(params.get("refresh_token") ?? "");
  const [row] = await db.select({ token: refreshTokens, grant: grants }).from(refreshTokens).innerJoin(grants, eq(refreshTokens.grantId, grants.id)).where(and(eq(refreshTokens.hash, hash), eq(grants.clientId, clientId), eq(grants.resource, resource), eq(grants.revoked, false)));
  if (!row || row.token.expiresAt <= new Date()) throw invalid();
  await assertAgent(row.grant.agentId);
  let scopes = row.grant.scopes;
  if (params.has("scope")) {
    const requested = [...new Set((params.get("scope") ?? "").split(/\s+/))] as AgentScope[];
    if (!requested.length || requested.some(s => !scopes.includes(s))) throw new OAuthError("invalid_scope", "Renovação não pode ampliar permissões.");
    scopes = requested;
  }
  const consumed = await db.update(refreshTokens).set({ used: true }).where(and(eq(refreshTokens.hash, hash), eq(refreshTokens.used, false))).returning({ hash: refreshTokens.hash });
  if (!consumed.length) {
    // Reutilização de refresh revoga toda a família, inclusive o novo access token.
    await revokeGrant(row.grant.id, clientId);
    throw invalid();
  }
  const updated = await db.update(grants).set({ accessHash: digest(access), accessExpiresAt: expires(ACCESS_SECONDS), scopes }).where(and(eq(grants.id, row.grant.id), eq(grants.revoked, false))).returning({ id: grants.id });
  if (!updated.length) throw invalid();
  // A família tem prazo absoluto; renovar não mantém uma conexão abandonada para sempre.
  await db.insert(refreshTokens).values({ hash: digest(refresh), grantId: row.grant.id, expiresAt: row.token.expiresAt });
  return tokenResponse(access, refresh, scopes);
}
export async function verifyOAuthAccess(token: string): Promise<AgentIdentity | null> {
  const db = await getDb();
  const [row] = await db.select({ grant: grants, agent: agentTokens }).from(grants).innerJoin(agentTokens, eq(grants.agentId, agentTokens.id)).where(and(eq(grants.accessHash, digest(token)), eq(grants.resource, oauthResource()), gt(grants.accessExpiresAt, new Date()), eq(grants.revoked, false), eq(agentTokens.revoked, false)));
  if (!row) return null;
  const scopes = row.grant.scopes.filter(s => row.agent.scopes.includes(s) || row.agent.scopes.includes("admin"));
  if (!row.agent.lastUsedAt || Date.now() - row.agent.lastUsedAt.getTime() > 60_000) await db.update(agentTokens).set({ lastUsedAt: new Date() }).where(eq(agentTokens.id, row.agent.id));
  return { id: row.agent.id, name: row.agent.name, scopes };
}
async function revokeGrant(id: string, clientId: string) {
  const db = await getDb();
  const [grant] = await db.update(grants).set({ revoked: true }).where(and(eq(grants.id, id), eq(grants.clientId, clientId))).returning({ agentId: grants.agentId });
  if (grant) await db.update(agentTokens).set({ revoked: true }).where(eq(agentTokens.id, grant.agentId));
}
export async function revokeOAuthToken(params: URLSearchParams) {
  const db = await getDb();
  const hash = digest(params.get("token") ?? "");
  const clientId = params.get("client_id") ?? "";
  const [refresh] = await db.select().from(refreshTokens).where(eq(refreshTokens.hash, hash));
  if (refresh) await revokeGrant(refresh.grantId, clientId);
  const [access] = await db.select({ id: grants.id }).from(grants).where(and(eq(grants.accessHash, hash), eq(grants.clientId, clientId)));
  if (access) await revokeGrant(access.id, clientId);
}

export const oauthHeaders = { "Cache-Control": "no-store", Pragma: "no-cache" };
export function oauthErrorResponse(error: unknown) {
  if (!(error instanceof OAuthError)) throw error;
  return Response.json({ error: error.code, error_description: error.message }, { status: error.status, headers: oauthHeaders });
}
export async function readOAuthForm(req: Request) {
  if (!req.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) throw new OAuthError("invalid_request", "Use application/x-www-form-urlencoded.");
  const text = await req.text();
  if (text.length > 16384) throw new OAuthError("invalid_request", "Requisição longa demais.");
  return new URLSearchParams(text);
}
