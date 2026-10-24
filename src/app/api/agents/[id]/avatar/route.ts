import { isAuthenticated } from "@/lib/auth";
import { getAgentAvatar } from "@/server/agent-avatars";

/** Foto de um agente (só para a sessão do proprietário). Com ?v= a resposta é imutável no cache. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) return new Response("unauthorized", { status: 401 });
  const { id } = await params;
  const a = await getAgentAvatar(id);
  if (!a) return new Response(null, { status: 404 });
  const versioned = new URL(req.url).searchParams.has("v");
  return new Response(Buffer.from(a.data, "base64"), {
    headers: { "content-type": a.type, "cache-control": versioned ? "private, max-age=31536000, immutable" : "private, no-cache", "x-content-type-options": "nosniff" },
  });
}
