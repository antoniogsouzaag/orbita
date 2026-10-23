import { type NextRequest } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getVaultProvider } from "@/server/vault";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", avif: "image/avif", pdf: "application/pdf", html: "text/plain; charset=utf-8", md: "text/markdown; charset=utf-8", txt: "text/plain; charset=utf-8", json: "application/json" };

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) return new Response("unauthorized", { status: 401 });
  const p = req.nextUrl.searchParams.get("p") ?? "";
  if (!p || p.includes("..") || p.startsWith("/")) return new Response("bad path", { status: 400 });
  const provider = getVaultProvider();
  if (!provider) return new Response("vault not configured", { status: 404 });
  try {
    const buf = await provider.readBinary(p);
    const ext = p.split(".").pop()?.toLowerCase() ?? "";
    return new Response(new Uint8Array(buf), {
      headers: { "content-type": TYPES[ext] ?? "application/octet-stream", "cache-control": "private, max-age=300", "content-security-policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'", "x-content-type-options": "nosniff" },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
