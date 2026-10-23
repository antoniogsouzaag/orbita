import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/** Rotas acessíveis sem sessão (as de API validam o próprio token). */
const PUBLIC = [/^\/login/, /^\/api\/calendar\/(feed|sync)/, /^\/api\/context/, /^\/api\/ops\/(ingest|alvos)/, /^\/api\/mcp/, /^\/api\/capture$/, /^\/api\/cron\//, /^\/api\/health/, /^\/manifest\.webmanifest$/, /^\/robots\.txt$/];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
