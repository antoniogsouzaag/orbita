/** Layout editável do post: o mesmo slides.html que o render.mjs do marketing transforma em JPG.
 *  Regras puras (sem DOM nem rede) para o editor e para o envio. */

export const LAYOUT_TYPE = "text/html";
export const LAYOUT_FILENAME = "layout.html";
export const isLayout = (contentType: string) => contentType.split(";")[0].trim() === LAYOUT_TYPE;

/**
 * Tira o que pode executar código. O editor ainda abre o HTML num iframe com sandbox sem scripts;
 * isto é a segunda barreira e deixa o arquivo salvo limpo.
 */
export function sanitizeLayout(html: string) {
  return html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<(iframe|object|embed|frame|frameset|base)\b[\s\S]*?(<\/\1\s*>|\/?>)/gi, "")
    .replace(/<meta\b[^>]*http-equiv[^>]*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, "$1=$2#$2");
}

/** Fontes que o layout carrega (Google Fonts) e as que ele declara no CSS, sem repetir. */
export function layoutFonts(html: string) {
  const out = new Set<string>();
  for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'\s>]+)/g)) {
    for (const f of m[1].replace(/&amp;/g, "&").split("&")) {
      if (f.startsWith("family=")) out.add(decodeURIComponent(f.slice(7).split(":")[0]).replace(/\+/g, " "));
    }
  }
  for (const m of html.matchAll(/font(?:-family)?\s*:[^;{}]*?["']([^"']+)["']/g)) out.add(m[1]);
  return [...out];
}

/** Quantos slides o layout tem (id="s1".."sN", a mesma regra do render.mjs). */
export const slideCount = (html: string) => (html.match(/id=["']s\d+["']/g) ?? []).length;

/**
 * Nome de cada JPG gerado. Reaproveita o prefixo dos slides já enviados (AGLABS-rotinas-01.jpg),
 * porque no agendamento o mesmo nome enviado de novo vale a versão mais recente.
 */
export function slideFileNames(count: number, existing: string[]) {
  const prefix = existing.map(f => /^(.*)-\d{2}\.(jpe?g|png|webp)$/i.exec(f)?.[1]).find(Boolean) ?? "layout";
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(i + 1).padStart(2, "0")}.jpg`);
}

/** Cor computada (rgb/rgba) para o input type=color (#rrggbb). Transparente vira null. */
export function toHex(color: string): string | null {
  const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?\s*\)/.exec(color);
  if (!m) return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : null;
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;
  return "#" + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, "0")).join("");
}

/** Deslocamento atual da propriedade CSS `translate` ("12px -4px" → [12, -4]). */
export function parseTranslate(value: string | null | undefined): [number, number] {
  if (!value || value === "none") return [0, 0];
  const [x = "0", y = "0"] = value.trim().split(/\s+/);
  return [parseFloat(x) || 0, parseFloat(y) || 0];
}
