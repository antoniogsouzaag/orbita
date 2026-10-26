import { NextResponse, type NextRequest } from "next/server";
import { chatRequestSchema } from "@/lib/orbe-chat";
import { isAuthenticated } from "@/lib/auth";
import { aiEnabled, askStream } from "@/server/ai";

// Source retrieval and the final synthesis share this invocation. Keep the
// stream bounded while allowing a company analysis to finish after lookups.
export const maxDuration = 180;

const Body = chatRequestSchema;

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!aiEnabled()) return NextResponse.json({ error: "Configure OPENAI_API_KEY em Integrações para usar a IA." }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pergunta inválida" }, { status: 400 });
  const history = "question" in parsed.data ? [{ role: "user" as const, content: parsed.data.question }] : parsed.data.messages;
  if (history.at(-1)?.role !== "user") return NextResponse.json({ error: "A última mensagem deve ser sua" }, { status: 400 });
  const stream = await askStream(history, { scope: parsed.data.scope ?? "pessoal", readOnly: parsed.data.readOnly ?? false, signal: req.signal });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
