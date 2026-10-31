/** Regras puras do agendamento no Postiz (sem rede). Espelham o agendar-fila-postiz.mjs do repo marketing,
 *  que é o caminho validado em produção desde 30/09/2026. */
import type { SocialBrand, SocialNetwork } from "./social-pipeline";

export type PostizChannel = { id: string; name: string; identifier: string; disabled?: boolean; customer?: { id: string; name: string } | null };
export type PostizMedia = { id: string; path: string };

const escapeHtml = (t: string) => t.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** Um <p> por linha e <p>⠀</p> (braille em branco) por linha vazia: o Postiz troca cada <p> por uma quebra e descarta <br>. */
export function captionToHtml(text: string) {
  return text.trim().split(/\r?\n/).map(l => l.trim())
    .map(l => l ? `<p>${escapeHtml(l.replace(/\*\*|__/g, ""))}</p>` : "<p>⠀</p>").join("");
}

// Grupos (customers) do Postiz por marca. Members ainda não tem grupo próprio: cai no nome do canal.
const BRAND_GROUPS: Record<SocialBrand, { groups: string[]; name: RegExp }> = {
  aglabs: { groups: ["8b2560ec-d5c9-4290-9bf7-4b71555ed766"], name: /ag[ _]?labs/i },
  mecard: { groups: ["93b212db-9b05-4841-a6ba-e0bcc2c70837"], name: /mecard/i },
  barberias: { groups: [], name: /barber/i },
  members: { groups: [], name: /members/i },
};
const NETWORK_ID: Record<SocialNetwork, RegExp> = {
  instagram: /^instagram(-standalone)?$/, tiktok: /^tiktok$/, youtube: /^youtube$/, linkedin: /^linkedin(-page)?$/, threads: /^threads$/, facebook: /^facebook$/,
};

/** Canal ativo da marca na rede pedida. Nunca devolve canal de outra marca. */
export function pickChannel(channels: PostizChannel[], brand: SocialBrand, network: SocialNetwork, extraGroups: string[] = []): PostizChannel | null {
  const rule = BRAND_GROUPS[brand];
  const groups = [...rule.groups, ...extraGroups];
  const ofBrand = channels.filter(c => !c.disabled && NETWORK_ID[network].test(c.identifier)
    && (c.customer?.id ? groups.includes(c.customer.id) || rule.name.test(c.customer.name) : rule.name.test(c.name)));
  return ofBrand.length === 1 ? ofBrand[0] : ofBrand.find(c => c.identifier === "instagram-standalone") ?? ofBrand[0] ?? null;
}

export function buildSchedulePayload(input: { channel: PostizChannel; caption: string; media: PostizMedia[]; date: Date; title: string; comment?: string; isVideo?: boolean }) {
  const { channel } = input;
  const settings: Record<string, unknown> = { __type: channel.identifier };
  if (/^(instagram|facebook)/.test(channel.identifier)) settings.post_type = "post";
  if (/^linkedin/.test(channel.identifier) && input.media.length > 1) { settings.post_as_images_carousel = true; settings.carousel_name = input.title; }
  if (channel.identifier === "youtube") { settings.title = input.title.slice(0, 100); settings.type = "public"; }
  const value = [{ content: captionToHtml(input.caption), image: input.media }];
  if (input.comment) value.push({ content: captionToHtml(input.comment), image: [] });
  return {
    type: "schedule", date: input.date.toISOString(), shortLink: false, tags: [],
    posts: [{ integration: { id: channel.id }, value, settings }],
  };
}

/** Ordem das mídias no carrossel: número no fim do nome (…-01.jpg, …-02.jpg); sem número, a ordem de envio. */
export function orderMedia<T extends { filename: string; createdAt: Date | string }>(items: T[]) {
  const n = (f: string) => Number(/(\d+)\.[a-z0-9]+$/i.exec(f)?.[1] ?? Number.POSITIVE_INFINITY);
  return [...items].sort((a, b) => n(a.filename) - n(b.filename) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/* ───────────── Várias redes por post (AG LABS) ───────────── */

/** Redes extras que cada marca recebe ao aprovar. YouTube só com vídeo vertical (Shorts). */
const FANOUT: Partial<Record<SocialBrand, SocialNetwork[]>> = {
  aglabs: ["instagram", "facebook", "linkedin", "threads", "youtube"],
};
export function fanoutNetworks(brand: SocialBrand, primary: SocialNetwork, isVideo: boolean): SocialNetwork[] {
  const list = FANOUT[brand] ?? [primary];
  const all = list.includes(primary) ? list : [primary, ...list];
  return all.filter(n => n !== "youtube" || isVideo);
}

// Linha do CTA de palavra-chave ("Comenta ARQUIVO que…"). Só o Instagram tem a automação da DM.
const CTA_LINE = /^.*\bComent[ae]\s+["“]?[A-Z0-9ÁÉÍÓÚÂÊÔÃÕÇ]{2,}\b.*$/gm;
const HASHTAG = /#[\p{L}\p{N}_]+/gu;
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;
const tidy = (t: string) => t.replace(/^[ \t]+|[ \t]+$/gm, "").replace(/ {2,}/g, " ").replace(/(\r?\n){3,}/g, "\n\n").trim();

/** Legenda de cada rede, adaptada da legenda do Instagram (mesma regra do pipeline do marketing). */
export function captionFor(network: SocialNetwork, caption: string, opts: { pageUrl?: string | null; title?: string } = {}): { content: string; comment?: string } {
  const link = opts.pageUrl ?? "";
  if (network === "instagram") return { content: tidy(caption) };
  if (network === "facebook") {
    let c = caption.replace(CTA_LINE, link ? `Material e detalhes: ${link}` : "");
    const tags = [...c.matchAll(HASHTAG)].map(m => m[0]);
    if (tags.length > 3) c = c.replace(HASHTAG, t => (tags.indexOf(t) < 3 ? t : ""));
    return { content: tidy(c) };
  }
  if (network === "linkedin") {
    const c = tidy(caption.replace(CTA_LINE, "").replace(HASHTAG, "").replace(EMOJI, ""));
    return link ? { content: `${c}\n\nLink no primeiro comentário.`, comment: link } : { content: c };
  }
  if (network === "threads") {
    // Threads aceita 500 caracteres: parágrafos inteiros até caber, sem hashtags, e o link no fim.
    const tail = link ? `\n\nMaterial: ${link}` : "";
    const paras = tidy(caption.replace(CTA_LINE, "").replace(HASHTAG, "")).split(/\n{2,}/);
    let out = "";
    for (const p of paras) { const next = out ? `${out}\n\n${p}` : p; if (next.length + tail.length > 500) break; out = next; }
    if (!out) out = paras[0].slice(0, 497 - tail.length).trimEnd() + "…";
    return { content: out + tail };
  }
  if (network === "youtube") {
    const c = tidy(caption.replace(CTA_LINE, link ? `Material: ${link}` : ""));
    return { content: c.slice(0, 4900) };
  }
  return { content: tidy(caption) };
}
