// Envia o slides.html de um post para a Órbita, como layout editável.
//
//   node scripts/enviar-layout.mjs <slides.html> <postId>
//   node scripts/enviar-layout.mjs <slides.html> --saida layout.html   (só gera o arquivo, sem enviar)
//
// As imagens locais (assets/foto.jpg, avatar.png, url(...) no CSS) entram embutidas em data:,
// para o editor abrir e gerar os JPGs no navegador sem depender da pasta do projeto.
// Usa ORBITA_PUBLIC_URL (padrão https://orb.aglabs.api.br) e ORBITA_MCP_TOKEN (token de agente com escopo tarefas).

import fs from "node:fs";
import path from "node:path";

const MAX = 8 * 1024 * 1024;
const TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf" };

const [src, ...rest] = process.argv.slice(2);
const outIdx = rest.indexOf("--saida");
const out = outIdx >= 0 ? rest[outIdx + 1] : null;
const postId = rest.find(a => /^[0-9a-f-]{36}$/i.test(a));
if (!src || (!postId && !out)) {
  console.error("Uso: node scripts/enviar-layout.mjs <slides.html> <postId>  |  --saida <arquivo>");
  process.exit(1);
}

const dir = path.dirname(path.resolve(src));
let missing = 0;
const inline = ref => {
  // %23 = "#" já codificado, como o url(%23n) dentro de um SVG em data: (filtro de granulado).
  if (/^(data:|https?:|\/\/|#|%23)/i.test(ref)) return ref;
  const file = path.resolve(dir, decodeURIComponent(ref.split(/[?#]/)[0]));
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type || !fs.existsSync(file)) { missing++; console.warn(`! não achei ${ref}`); return ref; }
  return `data:${type};base64,${fs.readFileSync(file).toString("base64")}`;
};

const html = fs.readFileSync(src, "utf8")
  .replace(/(<(?:img|source)\b[^>]*?\ssrc=)(["'])([^"']+)\2/gi, (_, a, q, ref) => `${a}${q}${inline(ref)}${q}`)
  .replace(/url\((["']?)([^"')]+)\1\)/gi, (m, q, ref) => (/^data:/i.test(ref) ? m : `url(${q}${inline(ref)}${q})`));

const bytes = Buffer.byteLength(html);
console.log(`${path.basename(src)}: ${(bytes / 1024 / 1024).toFixed(2)} MB com as imagens embutidas${missing ? `, ${missing} arquivo(s) faltando` : ""}.`);
if (bytes > MAX) { console.error("Acima de 8 MB. Reduza as fotos (ex.: JPEG 1080 px, qualidade 85) e tente de novo."); process.exit(1); }

if (out) { fs.writeFileSync(out, html); console.log(`Gravado em ${out}.`); }
if (postId) {
  const base = (process.env.ORBITA_PUBLIC_URL || "https://orb.aglabs.api.br").replace(/\/$/, "");
  const token = process.env.ORBITA_MCP_TOKEN;
  if (!token) { console.error("Defina ORBITA_MCP_TOKEN."); process.exit(1); }
  const body = new FormData();
  body.set("file", new Blob([html], { type: "text/html" }), "layout.html");
  body.set("postId", postId);
  const res = await fetch(`${base}/api/redes/midia`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) { console.error(`Órbita respondeu ${res.status}: ${json.error ?? "erro"}`); process.exit(1); }
  console.log(`Layout anexado ao post ${postId}. Abra o post em Redes e use "Editar layout".`);
}
