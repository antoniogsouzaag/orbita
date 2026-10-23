import { NextResponse, type NextRequest } from "next/server";
import { isAuthenticated, tokenMatches } from "@/lib/auth";
import { buildContext, contextToMarkdown } from "@/server/context";

/**
 * Contexto operacional para agentes.
 * GET /api/context?format=md|json&live=1  com  Authorization: Bearer <CONTEXT_TOKEN>
 */
export async function GET(req: NextRequest) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!(tokenMatches(bearer, "CONTEXT_TOKEN") || (await isAuthenticated()))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ctx = await buildContext({ live: req.nextUrl.searchParams.get("live") === "1" });
  if (req.nextUrl.searchParams.get("format") === "json") return NextResponse.json(ctx);
  return new Response(contextToMarkdown(ctx), { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "no-store" } });
}
