import { NextResponse, type NextRequest } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { verifyAgentToken } from "@/server/agents";
import { listPostMedia, saveSocialMedia } from "@/server/social-media";

export const maxDuration = 30;

/** Sessão do Antonio ou agente com escopo tarefas/admin (Claude, OpenClaw). */
async function allowed(req: NextRequest) {
  if (await isAuthenticated()) return true;
  const agent = await verifyAgentToken(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
  return Boolean(agent?.scopes.some(s => s === "admin" || s === "tarefas"));
}

/** Upload multipart: campo "file", opcionais "postId" e "capa=1" (substitui a mídia principal). */
export async function POST(req: NextRequest) {
  if (!(await allowed(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Envie o arquivo no campo file." }, { status: 400 });
    const saved = await saveSocialMedia({
      bytes: new Uint8Array(await file.arrayBuffer()), filename: file.name, contentType: file.type,
      postId: (form.get("postId") as string | null) || null, setCover: form.get("capa") === "1", origin: req.nextUrl.origin,
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error && e.name !== "ZodError" ? e.message : "Tipo não aceito (JPEG, PNG, WebP ou MP4)." }, { status: 400 });
  }
}

/** Lista as mídias de um post: ?postId= */
export async function GET(req: NextRequest) {
  if (!(await allowed(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const postId = req.nextUrl.searchParams.get("postId");
  if (!postId) return NextResponse.json({ error: "Informe postId." }, { status: 400 });
  try { return NextResponse.json({ midias: await listPostMedia(postId, req.nextUrl.origin) }); }
  catch { return NextResponse.json({ error: "postId inválido." }, { status: 400 }); }
}
