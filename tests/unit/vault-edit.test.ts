import { beforeEach, describe, expect, it, vi } from "vitest";
const { write, index } = vi.hoisted(() => ({ write: vi.fn(), index: { files: [{ path: "nota.md", sha: "atual" }] } }));
vi.mock("@/server/vault", () => ({ getVaultProvider: () => ({ write }), getVaultIndex: async () => index, invalidateVault: vi.fn() }));
import { editVault, editVaultSchema } from "@/server/vault-edit";

beforeEach(() => write.mockReset());
describe("escrita versionada no vault", () => {
  it("recusa caminhos de sistema, traversal e configuração do vault", () => {
    for (const caminho of ["../segredo.md", "C:\\vault\\nota.md", ".obsidian/config.md", "/nota.md", "a/../../b.md"]) {
      expect(editVaultSchema.safeParse({ caminho, conteudo: "texto", versao: null, motivo: "ajuste aprovado" }).success).toBe(false);
    }
  });
  it("não sobrescreve uma nota com versão antiga ou ausente", async () => {
    for (const versao of [null, "antiga"]) await expect(editVault({ caminho: "nota.md", conteudo: "novo", versao, motivo: "ajuste aprovado" })).rejects.toThrow("Conflito");
    expect(write).not.toHaveBeenCalled();
    await editVault({ caminho: "nota.md", conteudo: "novo", versao: "atual", motivo: "ajuste aprovado" });
    expect(write).toHaveBeenCalledWith("nota.md", "novo", expect.objectContaining({ sha: "atual" }));
  });
});
