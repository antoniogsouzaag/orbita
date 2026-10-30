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

export type QualityInput = {
  network: SocialNetwork;
  hook?: string | null;
  caption?: string | null;
  cta?: string | null;
  mediaUrl?: string | null;
  referenceUrl?: string | null;
  scheduledAt?: Date | string | null;
  checks?: { brandReviewed?: boolean; ctaDeliverable?: boolean } | null;
};
export type QualityCheck = { key: string; label: string; ok: boolean; required: boolean };

const isUrl = (value?: string | null) => { try { return Boolean(value) && /^https?:$/.test(new URL(value!).protocol); } catch { return false; } };

/** Checklist de qualidade de um post. Itens obrigatórios bloqueiam a aprovação. */
export function qualityChecks(post: QualityInput): QualityCheck[] {
  const caption = post.caption?.trim() ?? "";
  const hook = post.hook?.trim() ?? "";
  const limit = CAPTION_LIMITS[post.network];
  return [
    { key: "hook", label: "Gancho claro (10 a 120 caracteres)", ok: hook.length >= 10 && hook.length <= 120, required: true },
    { key: "caption", label: `Legenda escrita e dentro do limite (${limit.toLocaleString("pt-BR")})`, ok: caption.length > 0 && caption.length <= limit, required: true },
    { key: "cta", label: "CTA definido", ok: Boolean(post.cta?.trim()), required: true },
    { key: "ctaDeliverable", label: "CTA promete só material que existe e foi testado", ok: !post.cta?.trim() || Boolean(post.checks?.ctaDeliverable), required: true },
    { key: "media", label: "Mídia anexada (link)", ok: post.network === "threads" || post.network === "linkedin" ? true : isUrl(post.mediaUrl), required: true },
    { key: "brandReviewed", label: "Revisado quanto a tom e identidade da marca", ok: Boolean(post.checks?.brandReviewed), required: true },
    { key: "reference", label: "Referência/fonte registrada", ok: isUrl(post.referenceUrl), required: false },
    { key: "hashtags", label: "Até 5 hashtags", ok: (caption.match(/#[\p{L}\d_]+/gu)?.length ?? 0) <= 5, required: false },
  ];
}

export function qualityScore(post: QualityInput) {
  const checks = qualityChecks(post);
  const ok = checks.filter(c => c.ok).length;
  return { score: Math.round((ok / checks.length) * 100), blocking: checks.filter(c => c.required && !c.ok), checks };
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
