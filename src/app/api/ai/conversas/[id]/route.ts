import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";
import { deleteConversation, getConversation, saveConversation } from "@/server/orbe-conversations";

type Ctx = { params: Promise<{ id: string }> };
const scopeOf = (req: NextRequest) => (req.nextUrl.searchParams.get("escopo") === "empresa" ? "empresa" : "pessoal");
const unauthorized = () => NextResponse.json({ error: "Não autenticado" }, { status: 401 });
const badId = () => NextResponse.json({ error: "Conversa inválida" }, { status: 400 });

export async function GET(req: NextRequest, { params }: Ctx) {
  if (!(await isAuthenticated())) return unauthorized();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return badId();
  const row = await getConversation(id, scopeOf(req));
  if (!row) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  return NextResponse.json({ id: row.id, title: row.title, messages: row.messages }, { headers: { "cache-control": "no-store" } });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await isAuthenticated())) return unauthorized();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return badId();
  try {
    await saveConversation(id, await req.json());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error && !(e instanceof z.ZodError) ? e.message : "Conversa inválida" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!(await isAuthenticated())) return unauthorized();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return badId();
  await deleteConversation(id, scopeOf(req));
  return NextResponse.json({ ok: true });
}
