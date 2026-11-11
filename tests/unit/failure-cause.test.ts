import { afterEach, describe, expect, it, vi } from "vitest";
import { ruleFailureCause, sanitizeFailureText } from "@/lib/failure-cause";

const jev = vi.hoisted(() => vi.fn());
vi.mock("@/server/decisions", () => ({ jevChoice: jev }));
import { triageFailure } from "@/server/failure-triage";

afterEach(() => { jev.mockReset(); });

describe("causa provável da falha de workflow", () => {
  it("resolve pelas regras o que a mensagem já entrega, sem chamar o Jev", async () => {
    expect(ruleFailureCause('Bad request: {"exists":false,"jid":"5511999990000@s.whatsapp.net"}')).toBe("dado_invalido");
    expect(ruleFailureCause("Request failed with status code 401")).toBe("credencial");
    expect(ruleFailureCause("The access token expired")).toBe("credencial");
    expect(ruleFailureCause("connect ECONNREFUSED 10.0.0.2:8080")).toBe("servico_externo");
    expect(ruleFailureCause("429 Too Many Requests")).toBe("limite");
    expect(ruleFailureCause("Algo estranho aconteceu")).toBeNull();
    expect(await triageFailure({ workflow: "envio", message: "Request failed with status code 503" })).toEqual({ cause: "servico_externo", source: "regras" });
    expect(jev).not.toHaveBeenCalled();
  });

  it("manda ao Jev só o texto sem e-mail, telefone, token ou segredo de URL", async () => {
    jev.mockResolvedValue({ choice: "logica", confidence: 0.9, probability: 0.8 });
    const message = "Falha ao gravar para maria@cliente.com.br, fone +55 (11) 99999-0000, em https://api.exemplo.com/x?token=abcDEF123&id=7 com chave chaveFicticia0123456789abcdef0123456789abcdef";
    expect(await triageFailure({ workflow: "grava lead", node: "HTTP", message })).toEqual({ cause: "logica", source: "jev" });
    const sent = JSON.stringify(jev.mock.calls[0][0].state);
    for (const leaked of ["maria@", "99999", "abcDEF123", "chaveFicticia0123456789"]) expect(sent).not.toContain(leaked);
    expect(sanitizeFailureText(message)).toContain("[email]");
  });

  it("sem indicação firme, resposta inválida ou Jev fora do ar não registra causa", async () => {
    jev.mockResolvedValueOnce({ choice: "logica", confidence: 0.5, probability: 0.9 });
    expect(await triageFailure({ workflow: "w", message: "erro qualquer" })).toBeNull();
    jev.mockResolvedValueOnce({ choice: "indefinido", confidence: 0.95, probability: 0.95 });
    expect(await triageFailure({ workflow: "w", message: "erro qualquer" })).toBeNull();
    jev.mockResolvedValueOnce(null);
    expect(await triageFailure({ workflow: "w", message: "erro qualquer" })).toBeNull();
    jev.mockRejectedValueOnce(new Error("rede"));
    expect(await triageFailure({ workflow: "w", message: "erro qualquer" })).toBeNull();
    expect(await triageFailure({ workflow: "w", message: "" })).toBeNull();
  });
});
