import { revalidatePath } from "next/cache";
import { z } from "zod";
import { aiEnabled, askOnce } from "@/server/ai";
import { criarNota, quickTask, registrarLancamento } from "@/server/assistant";
import { parseExpense, verifyCaptureToken } from "@/server/capture";

export const maxDuration = 60;

const Body = z.object({
  texto: z.string().trim().min(1).max(2000),
  /** ia (padrão): a IA entende e age · tarefa · nota · gasto: sem IA, direto. */
  modo: z.enum(["ia", "tarefa", "nota", "gasto"]).optional(),
});

/**
 * Captura pelo iPhone (app Atalhos / Siri): POST com Authorization: Bearer cap_…
 * Responde { ok, mensagem } — o atalho pode falar a mensagem em voz alta.
 */
export async function POST(req: Request) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!(await verifyCaptureToken(bearer))) return Response.json({ ok: false, mensagem: "Chave do atalho inválida. Gere outra em Configurações." }, { status: 401 });
  const ct = req.headers.get("content-type") ?? "";
  const raw = ct.includes("application/json") ? await req.json().catch(() => null) : { texto: await req.text() };
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return Response.json({ ok: false, mensagem: "Envie o texto no campo “texto”." }, { status: 400 });
  const { texto } = parsed.data;
  const modo = parsed.data.modo ?? (aiEnabled() ? "ia" : "tarefa");

  try {
    let mensagem: string;
    if (modo === "ia") {
      const r = await askOnce(`${texto}\n\n(Pedido feito por voz pelo iPhone: execute a ação se for um pedido e responda em uma ou duas frases curtas, sem markdown, para ser lida em voz alta.)`);
      mensagem = r.answer.replace(/[*_#`>]/g, "").trim() || (r.actions.length ? r.actions.map((a) => a.label).join(". ") : "Feito.");
    } else if (modo === "nota") {
      const [first, ...rest] = texto.split("\n");
      mensagem = (await criarNota.run({ titulo: first.slice(0, 200), conteudo: rest.join("\n") || null })).text;
    } else if (modo === "gasto") {
      const g = parseExpense(texto);
      if (!g) return Response.json({ ok: false, mensagem: "Não entendi o valor. Diga, por exemplo: café 12,50." }, { status: 422 });
      mensagem = (await registrarLancamento.run({ descricao: g.descricao, valor: g.valor, categoria: g.categoria, tipo: "despesa", data: null })).text;
    } else {
      mensagem = (await quickTask(texto)).text;
    }
    try {
      revalidatePath("/", "layout");
    } catch {}
    return Response.json({ ok: true, mensagem });
  } catch (e) {
    console.error("[capture]", e);
    return Response.json({ ok: false, mensagem: "Não consegui registrar agora. Tente de novo em instantes." }, { status: 500 });
  }
}
