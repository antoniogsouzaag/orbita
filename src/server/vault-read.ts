import "server-only";
import { z } from "zod";
import { getVaultIndexSafe } from "./vault";

export const readVaultSchema = z.object({
  caminho: z.string().trim().min(1).max(400).describe("Caminho ou nome da nota do vault"),
  inicio: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional().describe("Use proximo_inicio para continuar uma nota longa"),
  versao: z.string().min(1).max(200).optional().describe("Versão retornada na primeira página; obrigatória para continuar"),
});

/** ORBE e MCP usam o mesmo conteúdo, versão e contrato de continuação. */
export async function readVaultNote(input: z.infer<typeof readVaultSchema>) {
  const value = readVaultSchema.parse(input);
  const start = value.inicio ?? 0;
  if (start > 0 && !value.versao) return { ok: false as const, text: "Informe a versão da primeira página para continuar a nota." };
  const idx = await getVaultIndexSafe(Boolean(value.versao));
  if (!idx) return { ok: false as const, text: "Vault indisponível ou não configurado nesta consulta." };
  const path = idx.notes.has(value.caminho) ? value.caminho : idx.resolve(value.caminho.replace(/\.md$/i, ""));
  const note = path ? idx.notes.get(path) : null;
  if (!note) return { ok: false as const, text: "Nota não encontrada no vault." };
  if (value.versao && value.versao !== note.sha) return { ok: false as const, text: "A versão da nota mudou. Recomece a leitura do início para não misturar versões." };
  if (start > note.content.length) return { ok: false as const, text: "Posição fora do conteúdo da nota. Recomece a leitura do início." };
  let end = Math.min(start + 12_000, note.content.length);
  // Não separe um emoji entre páginas.
  if (end < note.content.length && /[\uD800-\uDBFF]/.test(note.content[end - 1])) end--;
  const partial = end < note.content.length;
  const page = {
    caminho: note.path,
    titulo: note.title,
    versao: note.sha,
    href: `/vault?p=${encodeURIComponent(note.path)}`,
    conteudo: { trecho: note.content.slice(start, end), inicio: start, total_caracteres: note.content.length, parcial: partial, proximo_inicio: partial ? end : null },
    ...(partial ? { continuacao: "Continue com caminho, versao e inicio=proximo_inicio até proximo_inicio ser null. Esta página é parcial." } : {}),
  };
  return { ok: true as const, page, text: JSON.stringify(page) };
}
