import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/** Rotas acessíveis sem sessão (as de API validam o próprio token). */
const PUBLIC = [/^\/api\/docs\/agentes$/, /^\/login/, /^\/api\/calendar\/(feed|sync)/, /^\/api\/context/, /^\/api\/integrations\/status$/, /^\/api\/ops\/(ingest|alvos)/, /^\/api\/mcp/, /^\/api\/capture$/, /^\/api\/redes\/midia(?:\/[\w-]+)?$/, /^\/api\/redes\/entregas$/, /^\/api\/cron\//, /^\/api\/health/, /^\/manifest\.webmanifest$/, /^\/robots\.txt$/];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (/^\/\.well-known\/oauth-(?:authorization-server|protected-resource(?:\/api\/mcp)?)$/.test(pathname) || /^\/api\/oauth\/(?:register|token|revoke)$/.test(pathname) || pathname === "/oauth/authorize") return NextResponse.next();
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();

  const ok = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
