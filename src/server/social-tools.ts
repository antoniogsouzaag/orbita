import "server-only";
import { z } from "zod";
import { qualityScore, SOCIAL_BRANDS, SOCIAL_STAGES, type SocialNetwork, type SocialStage } from "@/lib/social-pipeline";
import { createSocialPost, listSocialPosts, moveSocialPost, socialPostSchema, updateSocialPost } from "./social-posts";
import { ToolRefusal } from "./orbe-tools";
import { runDeliveryAudit } from "./social-delivery";
import { MEDIA_MAX_BYTES, saveSocialMedia } from "./social-media";

type ActionResult = { text: string; action?: { label: string; href: string } };
const href = "/redes?aba=producao";

/** Erros de regra do pipeline viram recusa legível para o agente (em vez de erro genérico). */
async function guard<T>(fn: () => Promise<T>) {
  try { return await fn(); }
  catch (e) { if (e instanceof Error && !(e instanceof z.ZodError)) throw new ToolRefusal(e.message); throw e; }
}

const summary = (p: Awaited<ReturnType<typeof listSocialPosts>>[number]) => {
  const q = qualityScore({ ...p, network: p.network as SocialNetwork });
  return {
    id: p.id, marca: p.brand, rede: p.network, formato: p.format, etapa: p.stage, titulo: p.title, gancho: p.hook, cta: p.cta,
    palavra_chave: p.checks?.keyword ?? null, midia: p.mediaUrl, referencia: p.referenceUrl, agendado_para: p.scheduledAt?.toISOString() ?? null,
    publicado_em: p.publishedUrl, qualidade: q.score, falta_para_aprovar: q.blocking.map(c => c.label), atualizado_em: p.updatedAt.toISOString(),
  };
};

const listSchema = z.object({
  marca: z.enum(SOCIAL_BRANDS).optional(),
  etapa: z.enum(SOCIAL_STAGES).optional(),
  limite: z.number().int().min(1).max(100).optional(),
});
export const redesListarPosts = {
  schema: listSchema,
  async run(v: z.infer<typeof listSchema>): Promise<ActionResult> {
    const rows = (await listSocialPosts()).filter(p => (!v.marca || p.brand === v.marca) && (!v.etapa || p.stage === v.etapa)).slice(0, v.limite ?? 40);
    return { text: JSON.stringify({ total: rows.length, posts: rows.map(summary), fonte: "Pipeline de redes da Órbita. Publicados com mais de 30 dias não aparecem." }), action: { label: "Produção de redes", href } };
  },
};

// Agentes criam até "revisao"; aprovar é decisão do Antonio na tela.
const AGENT_STAGES = ["ideia", "briefing", "rascunho", "revisao"] as const;
const createSchema = socialPostSchema.extend({ etapa: z.enum(AGENT_STAGES).optional().describe("Padrão ideia. Aprovar é feito por Antonio na tela.") });
export const redesCriarPost = {
  schema: createSchema,
  async run(v: z.infer<typeof createSchema>): Promise<ActionResult> {
    const { etapa, ...data } = v;
    const row = await guard(async () => {
      const created = await createSocialPost(data);
      return etapa && etapa !== "ideia" ? moveSocialPost(created.id, etapa) : created;
    });
    return { text: JSON.stringify({ criado: summary(row) }), action: { label: `Post: ${row.title}`, href } };
  },
};

const updateSchema = z.object({
  id: z.uuid(),
  campos: socialPostSchema.partial().optional().describe("Só os campos a alterar; checks é mesclado ao existente."),
  etapa: z.enum(SOCIAL_STAGES).optional(),
});
export const redesAtualizarPost = {
  schema: updateSchema,
  async run(v: z.infer<typeof updateSchema>, options: { allowApproval?: boolean } = {}): Promise<ActionResult> {
    if (v.etapa === "aprovado" && !options.allowApproval) throw new ToolRefusal("Aprovar é decisão do Antonio na tela de Produção. Mova para revisao.");
    const row = await guard(async () => {
      const current = (await listSocialPosts()).find(p => p.id === v.id);
      if (!current) throw new Error("Post não encontrado (ou publicado há mais de 30 dias).");
      let next = current;
      if (v.campos && Object.keys(v.campos).length) {
        const base = { brand: current.brand, network: current.network, format: current.format, title: current.title, hook: current.hook, caption: current.caption, cta: current.cta, mediaUrl: current.mediaUrl, referenceUrl: current.referenceUrl, publishedUrl: current.publishedUrl, notes: current.notes, scheduledAt: current.scheduledAt?.toISOString() ?? null };
        next = await updateSocialPost(v.id, { ...base, ...v.campos, checks: { ...current.checks, ...v.campos.checks } });
      }
      return v.etapa && v.etapa !== next.stage ? moveSocialPost(v.id, v.etapa as SocialStage) : next;
    });
    return { text: JSON.stringify({ atualizado: summary(row) }), action: { label: `Post: ${row.title}`, href } };
  },
};

export const redesAuditarEntregas = {
  schema: z.object({}),
  async run(): Promise<ActionResult> {
    return { text: JSON.stringify(await runDeliveryAudit()), action: { label: "Produção de redes", href } };
  },
};

// Agentes (Claude na nuvem, OpenClaw) anexam mídia por URL: a Órbita baixa e guarda, para não depender de link externo.
const attachSchema = z.object({
  id: z.uuid().describe("Post que recebe a mídia"),
  url: z.url().refine(u => /^https:\/\//.test(u), "Use um link https.").describe("Link público do arquivo (JPEG, PNG, WebP ou MP4 até 8 MB)"),
  capa: z.boolean().optional().describe("true substitui a mídia principal do post"),
});
export const redesAnexarMidia = {
  schema: attachSchema,
  async run(v: z.infer<typeof attachSchema>): Promise<ActionResult> {
    const origin = process.env.ORBITA_PUBLIC_URL ?? "https://orb.aglabs.api.br";
    const res = await fetch(v.url, { redirect: "follow", signal: AbortSignal.timeout(20_000) }).catch(() => null);
    if (!res?.ok) throw new ToolRefusal(`Não consegui baixar a mídia (${res?.status ?? "sem resposta"}).`);
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MEDIA_MAX_BYTES) throw new ToolRefusal("Arquivo acima de 8 MB.");
    const bytes = new Uint8Array(await res.arrayBuffer());
    const saved = await guard(() => saveSocialMedia({ bytes, contentType, filename: new URL(v.url).pathname.split("/").pop() || "midia", postId: v.id, setCover: v.capa ?? false, origin }));
    return { text: JSON.stringify({ anexada: { id: saved.id, url: saved.url, tamanho: saved.size, tipo: saved.contentType } }), action: { label: "Produção de redes", href } };
  },
};
