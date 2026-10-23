import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildMcpServer, verifyAgentToken } from "@/server/agents";

export const maxDuration = 60;

/**
 * Servidor MCP da Órbita (Streamable HTTP, sem estado).
 * Agentes conectam em https://orb.aglabs.api.br/api/mcp com  Authorization: Bearer orb_...
 */
async function handle(req: Request) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const agent = await verifyAgentToken(bearer);
  if (!agent) return Response.json({ jsonrpc: "2.0", error: { code: -32001, message: "Token de agente inválido ou revogado" }, id: null }, { status: 401 });
  const server = buildMcpServer(agent);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    queueMicrotask(() => void server.close().catch(() => {}));
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
