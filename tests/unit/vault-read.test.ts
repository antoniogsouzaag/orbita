import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let root: string;
beforeEach(async () => {
  vi.resetModules();
  root = await fs.mkdtemp(path.join(os.tmpdir(), "orbita-vault-read-"));
  vi.stubEnv("VAULT_LOCAL_PATH", root);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(root, { recursive: true, force: true });
});

describe("leitura versionada do vault", () => {
  it("reconstitui nota longa incluindo front matter e regras finais sem corte silencioso", async () => {
    const content = "---\ntitle: Manual\ntype: processo\nstatus: ativo\n---\n" + "Contexto 🧠\n".repeat(4000) + "\n## Aceite\nConferir a origem antes de concluir.";
    await fs.writeFile(path.join(root, "Manual.md"), content);
    const { readVaultNote } = await import("@/server/vault-read");
    let start = 0, version: string | undefined, full = "";
    do {
      const result = await readVaultNote({ caminho: "Manual", inicio: start, versao: version });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.text);
      expect(result.page.conteudo.total_caracteres).toBe(content.length);
      expect(result.page.conteudo.inicio).toBe(start);
      expect(result.page.conteudo.trecho.length).toBeLessThanOrEqual(12000);
      expect(result.page.versao).toBe(version ?? result.page.versao);
      full += result.page.conteudo.trecho;
      version = result.page.versao;
      if (result.page.conteudo.proximo_inicio === null) break;
      expect(result.page.conteudo.parcial).toBe(true);
      expect(result.page.conteudo.proximo_inicio).toBeGreaterThan(start);
      start = result.page.conteudo.proximo_inicio;
    } while (true);
    expect(full).toBe(content);
    expect(full).toContain("Conferir a origem antes de concluir.");
  });

  it("recusa misturar páginas de versões diferentes e exige versão na continuação", async () => {
    await fs.writeFile(path.join(root, "Manual.md"), "a".repeat(13000));
    const { readVaultNote } = await import("@/server/vault-read");
    const first = await readVaultNote({ caminho: "Manual.md" });
    if (!first.ok) throw new Error(first.text);
    expect((await readVaultNote({ caminho: "Manual.md", inicio: 12000 })).ok).toBe(false);
    await fs.writeFile(path.join(root, "Manual.md"), "b".repeat(13001));
    const changed = await readVaultNote({ caminho: "Manual.md", inicio: 12000, versao: first.page.versao });
    expect(changed.ok).toBe(false);
    expect(JSON.stringify(changed)).toContain("versão");
    expect(JSON.stringify(changed)).not.toContain("bbbb");
  });

  it("distingue nota vazia, inexistente e posição inválida", async () => {
    await fs.writeFile(path.join(root, "Vazia.md"), "");
    const { readVaultNote } = await import("@/server/vault-read");
    const empty = await readVaultNote({ caminho: "Vazia" });
    expect(empty).toMatchObject({ ok: true, page: { conteudo: { trecho: "", parcial: false, proximo_inicio: null } } });
    expect(await readVaultNote({ caminho: "Inexistente" })).toMatchObject({ ok: false });
    if (!empty.ok) throw new Error(empty.text);
    expect(await readVaultNote({ caminho: "Vazia", inicio: 1, versao: empty.page.versao })).toMatchObject({ ok: false });
    await expect(readVaultNote({ caminho: "Vazia", inicio: -1 })).rejects.toThrow();
  });

  it("mantém emoji inteiro na fronteira de paginação", async () => {
    const content = "a".repeat(11999) + "🧠fim";
    await fs.writeFile(path.join(root, "Emoji.md"), content);
    const { readVaultNote } = await import("@/server/vault-read");
    const first = await readVaultNote({ caminho: "Emoji" });
    if (!first.ok) throw new Error(first.text);
    expect(first.page.conteudo.proximo_inicio).toBe(11999);
    const second = await readVaultNote({ caminho: "Emoji", inicio: 11999, versao: first.page.versao });
    if (!second.ok) throw new Error(second.text);
    expect(first.page.conteudo.trecho + second.page.conteudo.trecho).toBe(content);
  });
});
