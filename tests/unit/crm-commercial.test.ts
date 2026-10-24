import { beforeEach, describe, expect, it, vi } from "vitest";
import { crmCommercialSummary, crmEmailFunnel } from "@/server/crm-commercial";
import { crmCall, crmConfigured } from "@/server/crm";
import { crmEmailInput, crmSummaryInput } from "@/lib/crm-aggregates";

vi.mock("@/server/crm", () => ({ crmCall: vi.fn(), crmConfigured: vi.fn() }));
const call = vi.mocked(crmCall);
const summary = { produto: "barberias", hoje: "2026-10-24", funil: { Lead: 3, Pagamento: 0 }, clientes: 2, contas_no_produto: { trial: 4, trial_encerrado: 1, ativo: 3, cancelado: 0 } };
const emails = { produto: "barberias", categoria: null, dias: 30, desde: "2026-09-24T03:00:00.000Z", total: { enviados: 5, entregues: 4, abertos: 2, cliques: 1, respostas: 0, falhas: 1, descadastros: 0, taxa_entrega: 80, taxa_abertura: 50, taxa_clique: 25, taxa_resposta: 0 } };
beforeEach(() => { vi.resetAllMocks(); vi.mocked(crmConfigured).mockReturnValue(true); });

describe("CRM comercial por produto", () => {
  it("normaliza o vínculo e mantém contas separadas de clientes", async () => {
    call.mockResolvedValue(summary);
    const result = await crmCommercialSummary({ produto: "BarberPro" });
    expect(call).toHaveBeenCalledExactlyOnceWith("crm_resumo", { produto: "barberias" });
    expect(result).toMatchObject({ status: "ok", source: "CRM MCP · crm_resumo", updatedAt: null, data: { clientes: 2, contas_no_produto: { ativo: 3, trial: 4, cancelado: 0 } } });
    expect(Date.parse(result.checkedAt)).not.toBeNaN();
    expect(result.data?.funil?.Contatado).toBeUndefined();
  });

  it("aceita o resumo global antigo sem exigir campos novos", async () => {
    call.mockResolvedValue({ hoje: summary.hoje, funil: summary.funil, clientes: 2 });
    const result = await crmCommercialSummary();
    expect(call).toHaveBeenCalledExactlyOnceWith("crm_resumo", {});
    expect(result.status).toBe("ok");
    expect(result.data?.contas_no_produto).toBeUndefined();
    expect(result.data?.por_produto).toBeUndefined();
  });

  it("preserva resumo global com produtos legados sem repassar rótulos livres", async () => {
    call.mockResolvedValue({ hoje: summary.hoje, produto: null, clientes: 2, por_produto: {
      barberias: { clientes: 0 }, "conteúdo": { clientes: 1 }, "private@example.test": { clientes: 1 },
    } });
    const result = await crmCommercialSummary();
    expect(result).toMatchObject({ status: "ok", data: { clientes: 2, por_produto: { barberias: { clientes: 0 } }, agrupamentos_sem_slug: 2 } });
    expect(JSON.stringify(result)).not.toMatch(/conteúdo|private@/);
  });

  it.each([undefined, null, "mecard"])("nunca atribui resumo global ou outro produto ao Barberias (%s)", async (produto) => {
    call.mockResolvedValue({ ...summary, produto });
    const result = await crmCommercialSummary({ produto: "barberias" });
    expect(result).toMatchObject({ status: "unavailable", data: null });
    expect(call).toHaveBeenCalledTimes(1); // no global fallback
  });

  it.each([{}, { produto: "barberias" }, { ...summary, clientes: -1 }, { ...summary, contas_no_produto: null }])("resposta vazia ou inválida não vira zero", async (data) => {
    call.mockResolvedValue(data);
    expect(await crmCommercialSummary({ produto: "barberias" })).toMatchObject({ status: "unavailable", data: null });
  });

  it("aceita campos parciais sem inventar valores ausentes", async () => {
    call.mockResolvedValue({ produto: "barberias", funil: { Lead: 0 } });
    expect(await crmCommercialSummary({ produto: "barberias" })).toMatchObject({ status: "ok", data: { funil: { Lead: 0 } } });
  });

  it("remove campos não agregados inclusive nos objetos internos", async () => {
    call.mockResolvedValue({ ...summary, email: "private@example.test", contatos: [{ nome: "Nome privado" }], cobertura: "Nome privado", contas_no_produto: { ...summary.contas_no_produto, nome: "Nome privado" }, por_produto: { mecard: { clientes: 1, nome: "Nome privado" } } });
    const result = JSON.stringify(await crmCommercialSummary({ produto: "barberias" }));
    expect(result).not.toMatch(/private@|Nome privado|contatos|cobertura/);
  });

  it("falha e configuração ausente preservam indisponibilidade, sem vazar erro da origem", async () => {
    call.mockRejectedValue(new Error("private@example.test"));
    const result = await crmCommercialSummary({ produto: "barberias" });
    expect(result).toMatchObject({ status: "unavailable", data: null });
    expect(JSON.stringify(result)).not.toContain("private@");
    call.mockClear();
    vi.mocked(crmConfigured).mockReturnValue(false);
    expect(await crmCommercialSummary({ produto: "barberias" })).toMatchObject({ status: "not_configured", data: null });
    expect(call).not.toHaveBeenCalled();
  });

  it("consulta e-mails por produto, janela e categoria, sem endereços ou conteúdo", async () => {
    call.mockResolvedValue({ ...emails, dias: 7, categoria: "campanha", por_categoria: { campanha: { enviados: 5, nome: "Nome privado" } }, por_origem: [{ origem: "private@example.test" }], assunto: "Nome privado" });
    const result = await crmEmailFunnel({ produto: "BARBERPRO", dias: 7, categoria: "campanha" });
    expect(call).toHaveBeenCalledExactlyOnceWith("crm_funil_emails", { produto: "barberias", dias: 7, categoria: "campanha" });
    expect(result).toMatchObject({ status: "ok", data: { total: { respostas: 0 }, por_categoria: { campanha: { enviados: 5 } } } });
    expect(JSON.stringify(result)).not.toMatch(/private@|Nome privado|por_origem|assunto/);
  });

  it("zero confirmado de envios não transforma taxa sem base em zero", async () => {
    call.mockResolvedValue({ ...emails, total: { enviados: 0, entregues: 0, taxa_entrega: null, taxa_abertura: null, taxa_clique: null, taxa_resposta: null } });
    const result = await crmEmailFunnel({ produto: "barberias", dias: null, categoria: null });
    expect(result).toMatchObject({ status: "ok", data: { total: { enviados: 0, taxa_entrega: null } } });
    expect(call).toHaveBeenCalledExactlyOnceWith("crm_funil_emails", { produto: "barberias", dias: 30 });
  });

  it.each([{ ...emails, produto: null }, { ...emails, dias: 7 }, { ...emails, desde: undefined }, { ...emails, total: {} }])("recusa e-mail sem cobertura confirmada", async (data) => {
    call.mockResolvedValue(data);
    expect(await crmEmailFunnel({ produto: "barberias" })).toMatchObject({ status: "unavailable", data: null });
  });

  it("recusa totais apenas de taxas e escopo estreito como se fosse geral", async () => {
    call.mockResolvedValue({ ...emails, total: { taxa_abertura: 50 } });
    expect(await crmEmailFunnel({ produto: "barberias" })).toMatchObject({ status: "unavailable", data: null });
    call.mockResolvedValue(emails);
    expect(await crmEmailFunnel()).toMatchObject({ status: "unavailable", data: null });
    call.mockResolvedValue(summary);
    expect(await crmCommercialSummary()).toMatchObject({ status: "unavailable", data: null });
  });

  it("recusa categoria diferente da solicitada", async () => {
    call.mockResolvedValue(emails);
    expect(await crmEmailFunnel({ produto: "barberias", categoria: "prospeccao" })).toMatchObject({ status: "unavailable", data: null });
  });

  it("tool de e-mail ausente não apaga o resumo disponível", async () => {
    call.mockImplementation(async (name) => { if (name === "crm_resumo") return summary; throw new Error("Unknown tool"); });
    const [commercial, email] = await Promise.all([crmCommercialSummary({ produto: "barberias" }), crmEmailFunnel({ produto: "barberias" })]);
    expect(commercial.status).toBe("ok");
    expect(email).toMatchObject({ status: "unavailable", data: null });
  });

  it("valida os limites antes de consultar o CRM", () => {
    for (const dias of [0, 366, 1.5, "30"]) expect(crmEmailInput.safeParse({ dias }).success).toBe(false);
    expect(crmEmailInput.safeParse({ categoria: "qualquer" }).success).toBe(false);
    expect(crmSummaryInput.safeParse({ produto: "private@example.test" }).success).toBe(false);
    expect(call).not.toHaveBeenCalled();
  });
});
