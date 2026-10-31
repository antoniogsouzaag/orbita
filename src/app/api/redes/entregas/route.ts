import { tokenMatches } from "@/lib/auth";
import { confirmDeliveries, pendingDeliveries } from "@/server/social-deliveries";

/** Usado pelo workflow do n8n "Órbita → entregas AG LABS" (Bearer OPS_TOKEN, o mesmo do /api/ops/ingest). */
const ok = (req: Request) => tokenMatches(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), "OPS_TOKEN");

export async function GET(req: Request) {
  if (!ok(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ itens: await pendingDeliveries() });
}

export async function POST(req: Request) {
  if (!ok(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  try { return Response.json(await confirmDeliveries(await req.json())); }
  catch { return Response.json({ error: "Corpo inválido: { itens: [{ postId, tabela }] }" }, { status: 400 }); }
}
