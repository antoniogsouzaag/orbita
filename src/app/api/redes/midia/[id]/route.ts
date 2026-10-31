import { NextResponse, type NextRequest } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { verifyAgentToken } from "@/server/agents";
import { getSocialMedia } from "@/server/social-media";

/** Serve a mídia de um post para a sessão do Antonio (prévia no Órbita) ou para agentes com token. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const ok = (await isAuthenticated()) || Boolean(await verifyAgentToken(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const row = await getSocialMedia(id);
  if (!row) return NextResponse.json({ error: "Mídia não encontrada." }, { status: 404 });
  return new NextResponse(Buffer.from(row.data, "base64"), {
    headers: {
      "Content-Type": row.contentType, "Content-Length": String(row.size),
      "Content-Disposition": `inline; filename="${row.filename}"`,
      "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff",
    },
  });
}
