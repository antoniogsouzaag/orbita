import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { dayPlans } from "@/db/schema";
import { isAuthenticated } from "@/lib/auth";
import { today } from "@/lib/dates";
import { aiEnabled, planDay } from "@/server/ai";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!aiEnabled()) return NextResponse.json({ error: "Configure OPENAI_API_KEY em Integrações para usar a IA." }, { status: 503 });
  const parsed = z.object({ prompt: z.string().max(1000).default(""), from: z.number().int().min(0).max(23), to: z.number().int().min(1).max(24) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.to <= parsed.data.from) return NextResponse.json({ error: "Horários inválidos" }, { status: 400 });
  try {
    const plan = await planDay(parsed.data);
    const db = await getDb();
    const date = today();
    await db.insert(dayPlans).values({ date, blocks: plan.blocks, summary: plan.summary, prompt: parsed.data.prompt }).onConflictDoUpdate({ target: dayPlans.date, set: { blocks: plan.blocks, summary: plan.summary, prompt: parsed.data.prompt, updatedAt: new Date() } });
    revalidatePath("/");
    return NextResponse.json({ ok: true, plan });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao planejar" }, { status: 500 });
  }
}
