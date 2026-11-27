import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildMcpServer, verifyAgentToken } from "@/server/agents";
import { oauthChallenge, oauthHeaders } from "@/server/mcp-oauth";

export const maxDuration = 60;

/**
 * Servidor MCP da Órbita (Streamable HTTP, sem estado).
 * Agentes conectam em https://orb.aglabs.api.br/api/mcp com  Authorization: Bearer orb_...
 */
async function handle(req: Request) {
  let status = 500;
  let authenticated = false;
  try {
    const bearer = req.headers.get("authorization")?.trim().match(/^Bearer\s+(\S+)$/i)?.[1];
    const agent = await verifyAgentToken(bearer);
    if (!agent) {
      status = 401;
      return Response.json({ jsonrpc: "2.0", error: { code: -32001, message: "Conecte sua conta Órbita ou use um token de agente válido." }, id: null }, { status, headers: { ...oauthHeaders, "WWW-Authenticate": oauthChallenge() } });
    }
    authenticated = true;
    const server = buildMcpServer(agent);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    try {
      const response = await transport.handleRequest(req);
      status = response.status;
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    } finally {
      queueMicrotask(() => void server.close().catch(() => {}));
    }
  } finally {
    // Somente metadados fixos do transporte. Nunca registrar Bearer, corpo ou argumentos.
    const accept = req.headers.get("accept") ?? "";
    console.info("[mcp-http]", JSON.stringify({ method: req.method, status, authenticated, acceptsJson: accept.includes("application/json"), acceptsEventStream: accept.includes("text/event-stream"), hasProtocolVersion: req.headers.has("mcp-protocol-version") }));
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
