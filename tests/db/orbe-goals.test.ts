import { describe, expect, it } from "vitest";
import { runAssistantTool } from "@/server/assistant";

describe("metas na conversa ORBE", () => {
  it("registra somente no espaço da conversa e permite consultar o resultado", async () => {
    const title = `Meta empresarial ${crypto.randomUUID()}`;
    const created = await runAssistantTool("criar_meta",{titulo:title,alvo:5,unidade:"ativações",prazo:"2026-11-30"},{scope:"empresa"});
    expect(created.ok).toBe(true);
    expect(created.action?.href).toBe("/metas?escopo=empresa");
    expect((await runAssistantTool("listar_metas",{},{scope:"empresa"})).text).toContain(title);
    expect((await runAssistantTool("listar_metas",{},{scope:"pessoal"})).text).not.toContain(title);
    expect((await runAssistantTool("criar_meta",{titulo:"Inválida",alvo:1,escopo:"pessoal"},{scope:"empresa"})).ok).toBe(false);
    expect((await runAssistantTool("criar_meta",{titulo:"Data inválida",alvo:1,prazo:"2026-02-31"},{scope:"empresa"})).ok).toBe(false);
  });
});
