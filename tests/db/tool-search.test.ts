import { describe, it, expect, vi } from "vitest";
import { getDb } from "@/db";
import { tasks, projects } from "@/db/schema";
import { insertNote } from "@/server/notes";
import { searchKnowledge } from "@/server/tool-search";
import { runAssistantTool } from "@/server/assistant";
vi.mock("@/server/vault", () => ({ getVaultProvider: () => null, vaultHealth: async () => ({ ok: false }), searchVault: vi.fn() }));

describe("busca por fonte e permissão", () => {
  it("Contexto consulta somente manual/vault e distingue indisponibilidade", async () => {
    const result = await searchKnowledge("permissões");
    expect(result.fontes.map(f => f.fonte)).toEqual(["documentacao", "vault"]);
    expect(result.fontes[0].status).toBe("ok");
    expect(result.fontes[1]).toMatchObject({ status: "indisponivel", resultados: null });
    await expect(searchKnowledge("teste", { source: "tarefas" })).rejects.toThrow("administrativo");
  });
  it("admin filtra tarefas, projetos e notas por espaço; ORBE impede troca", async () => {
    const db = await getDb();
    await db.insert(tasks).values([{ title: "buscaunica pessoal", scope: "pessoal" }, { title: "buscaunica empresa", scope: "empresa" }]);
    await db.insert(projects).values([{ name: "buscaunica pessoal", area: "pessoal" }, { name: "buscaunica empresa", area: "empresa" }]);
    await insertNote("buscaunica pessoal", "", "pessoal");
    await insertNote("buscaunica empresa", "", "empresa");
    for (const scope of ["pessoal", "empresa"] as const) {
      const result = await searchKnowledge("buscaunica", { internal: true, scope });
      const internal = result.fontes.filter(f => ["tarefas", "projetos", "notas"].includes(f.fonte));
      expect(internal).toHaveLength(3);
      for (const source of internal) {
        expect(source.status).toBe("ok");
        expect(source.resultados).toEqual([expect.objectContaining({ title: `buscaunica ${scope}` })]);
      }
    }
    const denied = await runAssistantTool("buscar", { consulta: "buscaunica", escopo: "pessoal" }, { scope: "empresa" });
    expect(denied.ok).toBe(false);
    const allowed = await runAssistantTool("buscar", { consulta: "buscaunica", fonte: "notas" }, { scope: "empresa", readOnly: true });
    expect(allowed.ok).toBe(true);
    expect(allowed.text).toContain("buscaunica empresa");
    expect(allowed.text).not.toContain("buscaunica pessoal");
  });
});
