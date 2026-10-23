import { NextResponse, type NextRequest } from "next/server";
import { isAuthenticated } from "@/lib/auth";

/** Busca de capas no Unsplash (precisa de UNSPLASH_ACCESS_KEY) e registro de download exigido pela API. */
export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return NextResponse.json({ error: "Busca indisponível: configure UNSPLASH_ACCESS_KEY (ou use as sugestões e uma URL própria)." }, { status: 503 });
  const track = req.nextUrl.searchParams.get("track");
  if (track) {
    if (/^[\w-]{5,40}$/.test(track)) await fetch(`https://api.unsplash.com/photos/${track}/download?client_id=${key}`).catch(() => {});
    return NextResponse.json({ ok: true });
  }
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&orientation=landscape&per_page=18&content_filter=high`, { headers: { authorization: `Client-ID ${key}`, "accept-version": "v1" }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return NextResponse.json({ error: `Unsplash respondeu ${res.status}` }, { status: 502 });
  const json = (await res.json()) as { results: { id: string; color: string; urls: { raw: string; small: string }; user: { name: string; links: { html: string } } }[] };
  return NextResponse.json({
    results: json.results.map((p) => ({ id: p.id, thumb: p.urls.small, url: `${p.urls.raw}&auto=format&fit=crop&w=2400&q=80`, author: p.user.name, authorUrl: p.user.links.html, color: p.color })),
  });
}
