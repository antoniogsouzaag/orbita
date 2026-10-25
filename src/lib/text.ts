/** Remove acentos e baixa a caixa — para buscas e comparações tolerantes. */
export function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function slugify(s: string): string {
  return normalize(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Só a primeira letra em maiúscula ("outubro de 2026" → "Outubro de 2026"); CSS `capitalize` erraria o "de". */
export function capitalizeFirst(s: string): string {
  return s ? s.charAt(0).toLocaleUpperCase("pt-BR") + s.slice(1) : s;
}
