import { isAuthenticated } from "@/lib/auth";
import { getAvatar } from "@/server/settings";

/** Foto do perfil (só para a sessão do proprietário). Com ?v= a resposta é imutável no cache. */
export async function GET(req: Request) {
  if (!(await isAuthenticated())) return new Response("unauthorized", { status: 401 });
  const a = await getAvatar();
  if (!a) return new Response(null, { status: 404 });
  const versioned = new URL(req.url).searchParams.has("v");
  return new Response(Buffer.from(a.data, "base64"), {
    headers: { "content-type": a.type, "cache-control": versioned ? "private, max-age=31536000, immutable" : "private, no-cache", "x-content-type-options": "nosniff" },
  });
}
