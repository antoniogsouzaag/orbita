import { NextResponse, type NextRequest } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { checkTargets, monitorTargets } from "@/server/ops";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const targets = await monitorTargets().catch(() => null);
  if (!targets) return NextResponse.json({ configured: false, total: 0, up: 0, down: [], results: [], checkedAt: new Date().toISOString() });
  const results = await checkTargets(targets, req.nextUrl.searchParams.get("force") === "1");
  const down = results.filter((r) => !r.ok);
  const body = { configured: true, total: results.length, up: results.length - down.length, down: down.map((d) => ({ name: d.name, url: d.url, group: d.priority })), checkedAt: new Date().toISOString() };
  if (req.nextUrl.searchParams.get("summary") === "1") return NextResponse.json(body);
  return NextResponse.json({ ...body, results });
}
