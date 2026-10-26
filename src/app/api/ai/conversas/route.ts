import { NextResponse, type NextRequest } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { listConversations } from "@/server/orbe-conversations";

const scopeOf = (req: NextRequest) => (req.nextUrl.searchParams.get("escopo") === "empresa" ? "empresa" : "pessoal");

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const rows = await listConversations(scopeOf(req));
  return NextResponse.json({ conversations: rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updatedAt.toISOString() })) }, { headers: { "cache-control": "no-store" } });
}
