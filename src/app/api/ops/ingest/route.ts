import { NextResponse, type NextRequest } from "next/server";
import { tokenMatches } from "@/lib/auth";
import { IngestSchema, ingest } from "@/server/ops-live";

/**
 * Recebe resultados dos monitores (n8n).
 * POST /api/ops/ingest  Authorization: Bearer <OPS_TOKEN>
 * { source, label?, everyMinutes?, links?: [{url,nome,grupo,ok,status,erro,ms}], domains?: [{dominio,depende,expiracao,erro}], workflowError?: {...} }
 */
export async function POST(req: NextRequest) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!tokenMatches(bearer, "OPS_TOKEN")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = IngestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "payload inválido", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  const counters = await ingest(parsed.data);
  return NextResponse.json({ ok: true, ...counters });
}
