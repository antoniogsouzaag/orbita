/** Remove acentos e baixa a caixa — para buscas e comparações tolerantes. */
export function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function slugify(s: string): string {
  return normalize(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
