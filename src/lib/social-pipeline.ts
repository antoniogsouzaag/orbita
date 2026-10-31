/** Regras do pipeline editorial de redes sociais (puras, sem acesso a banco). */

export const SOCIAL_BRANDS = ["aglabs", "members", "mecard", "barberias"] as const;
export type SocialBrand = (typeof SOCIAL_BRANDS)[number];
export const BRAND_LABELS: Record<SocialBrand, string> = { aglabs: "AG LABS", members: "Members", mecard: "MeCard", barberias: "Barberias" };

export const SOCIAL_NETWORKS = ["instagram", "tiktok", "youtube", "linkedin", "threads", "facebook"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];
export const NETWORK_LABELS: Record<SocialNetwork, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", linkedin: "LinkedIn", threads: "Threads", facebook: "Facebook" };
/** Limite de caracteres da legenda por rede. */
export const CAPTION_LIMITS: Record<SocialNetwork, number> = { instagram: 2200, tiktok: 2200, youtube: 5000, linkedin: 3000, threads: 500, facebook: 63206 };

export const SOCIAL_FORMATS = ["reels", "carrossel", "imagem", "story", "video", "texto"] as const;
export type SocialFormat = (typeof SOCIAL_FORMATS)[number];

export const SOCIAL_STAGES = ["ideia", "briefing", "rascunho", "revisao", "aprovado", "agendado", "publicado", "falhou"] as const;
export type SocialStage = (typeof SOCIAL_STAGES)[number];
export const STAGE_LABELS: Record<SocialStage, string> = { ideia: "Ideia", briefing: "Briefing", rascunho: "Rascunho", revisao: "Revisão", aprovado: "Aprovado", agendado: "Agendado", publicado: "Publicado", falhou: "Falhou" };

/** Estado das entregas de um post. Preenchido pela produção (página e mensagem) e pelo sistema (n8n, Postiz);
 *  nada aqui é marcado à mão. Campos antigos ficam só para leitura de posts anteriores. */
export type SocialChecks = {
  keyword?: string | null;
  /** Link da página do conteúdo gratuito (conteudo.aglabs.ia.br/conteudos/...). */
  pageUrl?: string | null;
  /** Texto que vai na DM de quem comentar a palavra-chave; precisa conter o pageUrl. */
  deliveryMessage?: string | null;
  mediaId?: string | null;
  /** Gravado pelo workflow do n8n ao confirmar cada linha. */
  n8nCodeDone?: boolean; n8nPostDone?: boolean;
  /** Gravado pela Órbita ao agendar no Postiz; nunca vem do formulário. */
  postiz?: { postId: string; integrationId: string; scheduledFor: string; at: string };
  brandReviewed?: boolean; ctaDeliverable?: boolean; libraryNeeded?: boolean; n8nDone?: boolean; pageDone?: boolean; libraryDone?: boolean;
};

export type QualityInput = {
  network: SocialNetwork;
  hook?: string | null;
  caption?: string | null;
  cta?: string | null;
  mediaUrl?: string | null;
  referenceUrl?: string | null;
  scheduledAt?: Date | string | null;
  checks?: SocialChecks | null;
};
export type QualityCheck = { key: string; label: string; ok: boolean; required: boolean };

const isUrl = (value?: string | null) => { try { return Boolean(value) && /^https?:$/.test(new URL(value!).protocol); } catch { return false; } };

/** Conferência automática de um post (ninguém marca nada): o que falta bloqueia aprovar e agendar. */
export function qualityChecks(post: QualityInput): QualityCheck[] {
  const caption = post.caption?.trim() ?? "";
  const hook = post.hook?.trim() ?? "";
  const limit = CAPTION_LIMITS[post.network];
  const kw = post.checks?.keyword?.trim();
  const page = post.checks?.pageUrl?.trim();
  const message = post.checks?.deliveryMessage?.trim();
  return [
    { key: "hook", label: "Gancho claro (10 a 120 caracteres)", ok: hook.length >= 10 && hook.length <= 120, required: true },
    { key: "caption", label: `Legenda escrita e dentro do limite (${limit.toLocaleString("pt-BR")})`, ok: caption.length > 0 && caption.length <= limit, required: true },
    { key: "cta", label: "CTA definido", ok: Boolean(post.cta?.trim()), required: true },
    { key: "media", label: "Mídia anexada", ok: post.network === "threads" || post.network === "linkedin" ? true : isUrl(post.mediaUrl), required: true },
    ...(kw ? [
      { key: "keywordInCaption", label: `Legenda pede a palavra ${kw.toUpperCase()}`, ok: caption.toUpperCase().includes(kw.toUpperCase()), required: true },
      { key: "pageUrl", label: "Página do conteúdo gratuito", ok: isUrl(page), required: true },
      { key: "deliveryMessage", label: "Mensagem da DM com o link da página", ok: Boolean(message && page && message.includes(page)), required: true },
    ] : []),
    { key: "reference", label: "Referência/fonte registrada", ok: isUrl(post.referenceUrl), required: false },
    { key: "hashtags", label: "Até 5 hashtags", ok: (caption.match(/#[\p{L}\d_]+/gu)?.length ?? 0) <= 5, required: false },
  ];
}

export function qualityScore(post: QualityInput) {
  const checks = qualityChecks(post);
  const ok = checks.filter(c => c.ok).length;
  return { score: Math.round((ok / checks.length) * 100), blocking: checks.filter(c => c.required && !c.ok), checks };
}

/** Andamento das entregas feitas pelo sistema (só leitura na tela). */
export function deliveryChecks(post: Pick<QualityInput, "checks">): QualityCheck[] {
  const c = post.checks ?? {};
  if (!c.keyword?.trim()) return [];
  const kw = c.keyword.trim().toUpperCase();
  return [
    { key: "n8nCodeDone", label: kw === "PROMPT" ? "PROMPT usa só a linha por post" : `Código ${kw} na tabela do n8n (ao agendar)`, ok: kw === "PROMPT" || Boolean(c.n8nCodeDone), required: false },
    { key: "n8nPostDone", label: "Linha do post com media_id (ao publicar)", ok: Boolean(c.n8nPostDone), required: false },
  ];
}

const BRT = "America/Sao_Paulo";
/** Horário único de publicação (20h de Brasília): o de maior alcance nos dados da AG LABS (05-CALENDARIO-E-PILARES). */
export const POST_HOUR = 20;
const dayKeyBRT = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: BRT });
/** 20h de Brasília (UTC−3, sem horário de verão) do dia `key` (AAAA-MM-DD). */
const at20 = (key: string) => new Date(`${key}T${String(POST_HOUR).padStart(2, "0")}:00:00-03:00`);

/** Próximo dia sem post da marca, sempre às 20h. Hoje só vale se ainda faltam mais de 2 h para as 20h. */
export function nextFreeSlot<T extends { brand: string; stage: string; scheduledAt: Date | null; id?: string }>(posts: T[], brand: string, now = new Date(), ignoreId?: string) {
  const taken = new Set(posts.filter(p => p.brand === brand && (ignoreId === undefined || p.id !== ignoreId) && p.scheduledAt && p.stage !== "falhou").map(p => dayKeyBRT(new Date(p.scheduledAt!))));
  for (let i = 0; i < 400; i++) {
    const key = dayKeyBRT(new Date(now.getTime() + i * 86_400_000));
    const slot = at20(key);
    if (slot.getTime() - now.getTime() < 2 * 3_600_000) continue;
    if (!taken.has(key)) return slot;
  }
  throw new Error("Sem dia livre no próximo ano.");
}

const AFTER_APPROVAL: SocialStage[] = ["aprovado", "agendado", "publicado"];

/** Valida a mudança de etapa. Retorna mensagem de erro ou null. */
export function stageError(post: QualityInput, to: SocialStage): string | null {
  if (AFTER_APPROVAL.includes(to)) {
    const { blocking } = qualityScore(post);
    if (blocking.length) return `Falta para aprovar: ${blocking.map(c => c.label).join("; ")}.`;
  }
  if ((to === "agendado" || to === "publicado") && !post.scheduledAt) return "Defina data e hora antes de agendar.";
  return null;
}

const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/** Agenda dos próximos `days` dias por marca, marcando lacunas (dias sem post agendado/aprovado). */
export function calendarGaps<T extends { brand: SocialBrand; stage: SocialStage; scheduledAt: Date | null }>(posts: T[], now = new Date(), days = 14) {
  const keys = Array.from({ length: days }, (_, i) => dayKey(new Date(now.getTime() + i * 86400000)));
  const live = posts.filter(p => p.scheduledAt && ["aprovado", "agendado", "publicado"].includes(p.stage));
  return SOCIAL_BRANDS.map(brand => {
    const byDay = keys.map(key => ({ day: key, posts: live.filter(p => p.brand === brand && dayKey(p.scheduledAt!) === key) }));
    return { brand, days: byDay, gaps: byDay.filter(d => !d.posts.length).length };
  });
}
