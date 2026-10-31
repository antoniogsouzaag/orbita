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

export function buildSchedulePayload(input: { channel: PostizChannel; caption: string; media: PostizMedia[]; date: Date; title: string }) {
  const { channel } = input;
  const settings: Record<string, unknown> = { __type: channel.identifier };
  if (/^(instagram|facebook)/.test(channel.identifier)) settings.post_type = "post";
  if (/^linkedin/.test(channel.identifier) && input.media.length > 1) { settings.post_as_images_carousel = true; settings.carousel_name = input.title; }
  return {
    type: "schedule", date: input.date.toISOString(), shortLink: false, tags: [],
    posts: [{ integration: { id: channel.id }, value: [{ content: captionToHtml(input.caption), image: input.media }], settings }],
  };
}

/** Ordem das mídias no carrossel: número no fim do nome (…-01.jpg, …-02.jpg); sem número, a ordem de envio. */
export function orderMedia<T extends { filename: string; createdAt: Date | string }>(items: T[]) {
  const n = (f: string) => Number(/(\d+)\.[a-z0-9]+$/i.exec(f)?.[1] ?? Number.POSITIVE_INFINITY);
  return [...items].sort((a, b) => n(a.filename) - n(b.filename) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
