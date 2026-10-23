import { NextResponse, type NextRequest } from "next/server";
import { isAuthenticated, tokenMatches } from "@/lib/auth";
import { syncStaleCalendars } from "@/server/calendar";

/** Sincroniza assinaturas ICS (para cron da Vercel ou do n8n: ?token=CONTEXT_TOKEN). */
export async function GET(req: NextRequest) {
  const authorized = (await isAuthenticated()) || tokenMatches(req.nextUrl.searchParams.get("token") ?? req.headers.get("authorization")?.replace(/^Bearer /, ""), "CONTEXT_TOKEN") || tokenMatches(req.headers.get("authorization")?.replace(/^Bearer /, ""), "CRON_SECRET");
  if (!authorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const report = await syncStaleCalendars(0);
  return NextResponse.json({ ok: report.failed === 0, ...report }, { status: report.failed ? 207 : 200 });
}
