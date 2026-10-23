import { NextResponse, type NextRequest } from "next/server";
import { tokenMatches } from "@/lib/auth";
import { monitorTargets } from "@/server/ops";

/**
 * Lista canônica de endereços a monitorar, lida do vault (Monitoramento de Disponibilidade).
 * Formato igual ao "Cadastro lista de links" do n8n: { items: [{ nome, url, grupo, prioridade, monitorCruzado }] }
 * monitorCruzado = vigiado pelo n8n do VPS-01 (a nota marca "monitor cruzado").
 */
export async function GET(req: NextRequest) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!tokenMatches(bearer, "OPS_TOKEN")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const targets = await monitorTargets();
  if (!targets) return NextResponse.json({ error: "vault indisponível" }, { status: 503 });
  return NextResponse.json({ items: targets.map((t) => ({ nome: t.name, url: t.url, grupo: t.group, prioridade: t.priority, monitorCruzado: /monitor cruzado/i.test(t.name) })), fonte: "vault: Monitoramento de Disponibilidade", geradoEm: new Date().toISOString() });
}
