/**
 * Render do layout em JPG no navegador, no mesmo espírito do render.mjs do marketing:
 * cada slide é desenhado sozinho numa janela de 1080 px, com o CSS original da arte.
 * O documento vai inteiro para um SVG (foreignObject); os outros slides saem e as fontes do
 * Google Fonts entram embutidas, porque uma imagem SVG não carrega nada de fora.
 */

const SUBSETS = /\/\*\s*(latin|latin-ext)\s*\*\//;

/** @font-face do Google Fonts com os arquivos embutidos em data: (só os subconjuntos latinos). */
export async function embeddedFontCSS(doc: Document): Promise<string> {
  const links = [...doc.querySelectorAll<HTMLLinkElement>("link[href*='fonts.googleapis.com']")].map(l => l.href);
  const parts: string[] = [];
  for (const href of links) {
    const css = await fetch(href).then(r => (r.ok ? r.text() : ""), () => "");
    // Cada bloco vem precedido de /* latin */, /* cyrillic */...; sem comentários, fica tudo.
    const blocks = css.split(/(?=\/\*[^*]*\*\/\s*@font-face)/).filter(b => b.includes("@font-face"));
    const keep = blocks.some(b => SUBSETS.test(b)) ? blocks.filter(b => SUBSETS.test(b)) : blocks;
    for (const block of keep) parts.push(await inlineUrls(block));
  }
  return parts.join("\n");
}

const cache = new Map<string, Promise<string>>();
async function inlineUrls(css: string) {
  const urls = [...new Set([...css.matchAll(/url\((["']?)(https:[^"')]+)\1\)/g)].map(m => m[2]))];
  let out = css;
  for (const u of urls) {
    if (!cache.has(u)) cache.set(u, fetch(u).then(r => r.blob()).then(toDataUrl).catch(() => u));
    out = out.split(u).join(await cache.get(u)!);
  }
  return out;
}
const toDataUrl = (b: Blob) => new Promise<string>((ok, fail) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = fail; r.readAsDataURL(b); });

/** Desenha uma peça do layout. `keepId` = id do slide (s1..sN); null = a página inteira (peça única). */
export async function renderPiece(doc: Document, opts: { keepId: string | null; allIds: string[]; width: number; height: number; fontCSS: string }): Promise<Blob> {
  const root = doc.documentElement.cloneNode(true) as HTMLElement;
  root.querySelector("#orbita-editor")?.remove();
  root.querySelectorAll("[data-orbita-sel]").forEach(n => n.removeAttribute("data-orbita-sel"));
  root.querySelectorAll("[contenteditable]").forEach(n => n.removeAttribute("contenteditable"));
  root.querySelectorAll("link[href*='fonts.googleapis.com'],link[href*='fonts.gstatic.com'],script").forEach(n => n.remove());
  // Só o slide pedido fica no documento (menor e sem imagens repetidas).
  for (const id of opts.allIds) if (id !== opts.keepId) root.querySelector(`[id="${id}"]`)?.remove();
  const head = root.querySelector("head") ?? root.insertBefore(doc.createElement("head"), root.firstChild);
  const st = doc.createElement("style");
  // Animações pulam para o fim, como o --virtual-time-budget do render.mjs (a imagem seria tirada no tempo zero).
  st.textContent = `${opts.fontCSS}\n*,*::before,*::after{animation-delay:-60s!important;transition:none!important}html,body{margin:0!important;background:#000}${opts.keepId ? `[id="${opts.keepId}"]{margin:0!important}` : ""}`;
  head.appendChild(st);

  const xhtml = new XMLSerializer().serializeToString(root);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.width}" height="${opts.height}"><foreignObject x="0" y="0" width="100%" height="100%">${xhtml}</foreignObject></svg>`;
  const img = new Image();
  img.decoding = "sync";
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = opts.width; canvas.height = opts.height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, opts.width, opts.height);
  ctx.drawImage(img, 0, 0);
  // A primeira rasterização às vezes sai antes das fontes embutidas; a segunda já vem com elas.
  await new Promise(r => setTimeout(r, 120));
  ctx.drawImage(img, 0, 0);
  return new Promise((ok, fail) => canvas.toBlob(b => (b ? ok(b) : fail(new Error("Falha ao gerar o JPG."))), "image/jpeg", 0.94));
}
