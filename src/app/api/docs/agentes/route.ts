import { fullAgentManualMarkdown } from "@/server/agent-catalog";
import { isAuthenticated, tokenMatches } from "@/lib/auth";
import { verifyAgentToken } from "@/server/agents";

export async function GET(req: Request) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const authorized = tokenMatches(bearer, "CONTEXT_TOKEN") || Boolean(await verifyAgentToken(bearer)) || await isAuthenticated();
  if (!authorized) return Response.json({ error: "unauthorized" }, { status: 401 });
  return new Response(fullAgentManualMarkdown(), { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "private, no-store" } });
}
