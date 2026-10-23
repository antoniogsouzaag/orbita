import { isAuthenticated, tokenMatches } from "@/lib/auth";
import { checkIntegrationHealth } from "@/server/integrations";

export const maxDuration = 60;

/** Read-only operational diagnostics for the owner and existing context clients. */
export async function GET(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!(await isAuthenticated()) && !tokenMatches(bearer, "CONTEXT_TOKEN")) return Response.json({ error: "unauthorized" }, { status: 401 });
  const items = await checkIntegrationHealth();
  return Response.json({ checkedAt: new Date().toISOString(), items }, { headers: { "Cache-Control": "private, no-store" } });
}
