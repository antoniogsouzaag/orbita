import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getVaultIndexSafe, getVaultProvider, invalidateVault } from "./vault";
import { today } from "@/lib/dates";

export const MEMORY_FOLDER = "90 - Administração/Memória Compartilhada";
export const memorySchema = z.object({
  titulo: z.string().trim().min(3).max(160),
  conteudo: z.string().trim().min(10).max(6000),
  fonte: z.string().trim().min(3).max(300).describe("Origem verificável: pedido do usuário, nota ou decisão"),
});

/** Entradas imutáveis evitam sobrescrever memórias de outros agentes. */
export async function rememberShared(input: z.infer<typeof memorySchema>) {
  const value = memorySchema.parse(input);
  const provider = getVaultProvider();
  if (!provider) throw new Error("Vault não configurado");
  const path = `${MEMORY_FOLDER}/${today()}-${randomUUID()}.md`;
  const content = `---\ntitle: ${JSON.stringify(value.titulo)}\ntype: memoria\nstatus: ativo\ncreated: ${today()}\nrecordedAt: ${JSON.stringify(new Date().toISOString())}\nsource: ${JSON.stringify(value.fonte)}\n---\n\n# ${value.titulo}\n\n${value.conteudo}\n\nFonte: ${value.fonte}\n\n[[00 - Início]]\n`;
  await provider.write(path, content, { message: `memória compartilhada: ${value.titulo}` });
  invalidateVault();
  return { text: `Memória salva no vault: ${path}`, action: { label: "Memória compartilhada", href: `/vault?p=${encodeURIComponent(path)}` } };
}

export async function sharedMemoryContext() {
  const index = await getVaultIndexSafe();
  if (!index) return "";
  return [...index.notes.values()].filter((note) => note.folder === MEMORY_FOLDER && note.frontmatter.status === "ativo")
    .sort((a, b) => String(b.frontmatter.recordedAt ?? b.path).localeCompare(String(a.frontmatter.recordedAt ?? a.path))).slice(0, 12)
    .map((note) => `### ${note.title} (${note.path})\n${note.body.slice(0, 1600)}`).join("\n\n").slice(0, 12000);
}
