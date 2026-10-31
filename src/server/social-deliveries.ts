import "server-only";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { socialPosts } from "@/db/schema";

/** Tabelas de entrega da AG LABS no n8n: "porCodigo" = MSG INSTAGRAM AGLABS, "porPost" = MSG POR POST AGLABS. */
export type DeliveryItem = { postId: string; tabela: "porCodigo" | "porPost"; codigo: string; media_id: string | null; mensagem: string; nota: string };

/**
 * O que o workflow do n8n ainda precisa gravar:
 * - porCodigo: post agendado/publicado com palavra nova (PROMPT não, ela é sempre por post);
 * - porPost: post publicado com media_id.
 */
export async function pendingDeliveries(): Promise<DeliveryItem[]> {
  const db = await getDb();
  const rows = await db.select().from(socialPosts).where(inArray(socialPosts.stage, ["agendado", "publicado"]));
  const out: DeliveryItem[] = [];
  for (const p of rows) {
    const c = p.checks ?? {};
    const codigo = c.keyword?.trim().toUpperCase();
    const mensagem = c.deliveryMessage?.trim();
    if (p.brand !== "aglabs" || !codigo || !mensagem) continue;
    const nota = `${p.title} · Órbita ${p.id.slice(0, 8)}`;
    if (codigo !== "PROMPT" && !c.n8nCodeDone) out.push({ postId: p.id, tabela: "porCodigo", codigo, media_id: null, mensagem, nota });
    if (p.stage === "publicado" && c.mediaId && !c.n8nPostDone) out.push({ postId: p.id, tabela: "porPost", codigo, media_id: c.mediaId, mensagem, nota });
  }
  return out;
}

const confirmSchema = z.object({ itens: z.array(z.object({ postId: z.uuid(), tabela: z.enum(["porCodigo", "porPost"]) })).max(200) });
/** O n8n confirma o que gravou; a flag correspondente vira true no post. */
export async function confirmDeliveries(raw: unknown) {
  const { itens } = confirmSchema.parse(raw);
  const db = await getDb();
  let ok = 0;
  for (const it of itens) {
    const [p] = await db.select().from(socialPosts).where(eq(socialPosts.id, it.postId));
    if (!p) continue;
    const flag = it.tabela === "porCodigo" ? { n8nCodeDone: true } : { n8nPostDone: true };
    await db.update(socialPosts).set({ checks: { ...p.checks, ...flag } }).where(eq(socialPosts.id, p.id));
    ok++;
  }
  return { confirmados: ok };
}
