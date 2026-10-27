import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildMcpServer, verifyAgentToken } from "@/server/agents";
import { oauthChallenge, oauthHeaders } from "@/server/mcp-oauth";

export const maxDuration = 60;

/**
 * Servidor MCP da Órbita (Streamable HTTP, sem estado).
 * Agentes conectam em https://orb.aglabs.api.br/api/mcp com  Authorization: Bearer orb_...
 */
async function handle(req: Request) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const agent = await verifyAgentToken(bearer);
  if (!agent) return Response.json({ jsonrpc: "2.0", error: { code: -32001, message: "Conecte sua conta Órbita ou use um token de agente válido." }, id: null }, { status: 401, headers: { ...oauthHeaders, "WWW-Authenticate": oauthChallenge() } });
  const server = buildMcpServer(agent);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(req);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } finally {
    queueMicrotask(() => void server.close().catch(() => {}));
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
