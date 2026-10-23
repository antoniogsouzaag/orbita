import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";
import { aiEnabled, askStream } from "@/server/ai";

export const maxDuration = 60;

const Body = z.union([
  z.object({ question: z.string().trim().min(1).max(4000) }),
  z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(20000) })).min(1).max(40) }),
]);

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!aiEnabled()) return NextResponse.json({ error: "Configure OPENAI_API_KEY em Integrações para usar a IA." }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pergunta inválida" }, { status: 400 });
  const history = "question" in parsed.data ? [{ role: "user" as const, content: parsed.data.question }] : parsed.data.messages;
  if (history.at(-1)?.role !== "user") return NextResponse.json({ error: "A última mensagem deve ser sua" }, { status: 400 });
  const stream = await askStream(history);
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
