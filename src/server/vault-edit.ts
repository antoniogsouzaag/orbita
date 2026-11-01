import "server-only";
import { z } from "zod";
import { getVaultIndex, getVaultProvider, invalidateVault } from "./vault";

export const editVaultSchema = z.object({
  caminho: z.string().min(4).max(400).refine((path) => path.endsWith(".md") && !path.startsWith("/") && !path.includes("..") && !/[\\:]/.test(path) && [...path].every((char) => char.charCodeAt(0) >= 32) && !path.split("/").some((part) => !part || part.startsWith(".")), "Use caminho relativo de nota Markdown"),
  conteudo: z.string().max(100000),
  versao: z.string().min(1).nullable().describe("SHA recebido ao ler a nota; null somente para criar nota nova"),
  motivo: z.string().trim().min(5).max(200),
});

export class VaultEditError extends Error {}

export async function editVault(input: z.infer<typeof editVaultSchema>) {
  const value = editVaultSchema.parse(input);
  const provider = getVaultProvider();
  if (!provider) throw new VaultEditError("Vault não configurado");
  const index = await getVaultIndex(true);
  const current = index.files.find((file) => file.path === value.caminho);
  if ((current?.sha ?? null) !== value.versao) throw new VaultEditError("Conflito: releia a nota e sua versão antes de salvar. Nenhuma alteração foi gravada.");
  await provider.write(value.caminho, value.conteudo, { sha: current?.sha, message: `vault: ${value.motivo}` });
  invalidateVault();
  return { text: `Nota salva: ${value.caminho}`, action: { label: "Nota do vault", href: `/vault?p=${encodeURIComponent(value.caminho)}` } };
}
