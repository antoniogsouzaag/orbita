"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { today } from "@/lib/dates";
import { bumpUpdated, newNoteTemplate } from "@/lib/frontmatter";
import { getVaultIndex, getVaultProvider, invalidateVault } from "@/server/vault";
import { rememberBlob } from "@/server/vault/index";

const pathSchema = z
  .string()
  .min(1)
  .max(400)
  .refine((p) => !p.includes("..") && !p.startsWith("/") && !/(^|\/)\.(git|obsidian)(\/|$)/.test(p), "Caminho inválido");

export async function saveVaultFile(path: string, content: string, baseSha: string | null) {
  await requireAuth();
  const p = pathSchema.parse(path);
  const provider = getVaultProvider();
  if (!provider) throw new Error("Vault não configurado");
  const idx = await getVaultIndex(true);
  const current = idx.files.find((f) => f.path === p);
  if (current && baseSha && current.sha !== baseSha) {
    return { ok: false as const, error: "Esta nota mudou no repositório desde que você abriu. Recarregue antes de salvar para não sobrescrever." };
  }
  const body = p.endsWith(".md") ? bumpUpdated(content, today()) : content;
  const { sha } = await provider.write(p, body, { message: `vault: atualiza ${p} pela Órbita`, sha: current?.sha });
  rememberBlob(sha, body);
  invalidateVault();
  revalidatePath("/vault");
  return { ok: true as const, sha, content: body };
}

export async function createVaultNote(folder: string, name: string) {
  await requireAuth();
  const clean = z.string().trim().min(1).max(160).parse(name).replace(/[\\/:*?"<>|#^[\]]/g, "-");
  const dir = folder ? pathSchema.parse(folder).replace(/\/$/, "") : "";
  const p = `${dir ? `${dir}/` : ""}${clean}.md`;
  const provider = getVaultProvider();
  if (!provider) throw new Error("Vault não configurado");
  const idx = await getVaultIndex(true);
  if (idx.files.some((f) => f.path.toLowerCase() === p.toLowerCase())) return { ok: false as const, error: "Já existe uma nota com esse nome nessa pasta." };
  await provider.write(p, newNoteTemplate(clean, today()), { message: `vault: cria ${p} pela Órbita` });
  invalidateVault();
  revalidatePath("/vault");
  return { ok: true as const, path: p };
}

export async function refreshVault() {
  await requireAuth();
  await getVaultIndex(true);
  revalidatePath("/vault");
}
