import { describe, expect, it } from "vitest";
import { awaitsOwner, githubSourceTag, latestReplyAt, proposalDisplayNotes, replyText } from "@/lib/proposals";
import { proposalReplySchema } from "@/server/proposals";

describe("contrato de propostas", () => {
  it("aceita apenas a origem GitHub exata, nunca URL livre ou pull request", () => {
    expect(githubSourceTag("https://github.com/aglabs-core/barberias/issues/94")).toBe("proposta:github:aglabs-core/barberias#94");
    for (const url of ["https://evil.example/aglabs-core/barberias/issues/94", "https://github.com/aglabs-core/barberias/pull/94", "https://github.com/aglabs-core/barberias/issues/94?token=x", "javascript:alert(1)"]) expect(githubSourceTag(url)).toBeNull();
  });
  it("marcador de idempotência fica fora da apresentação e registra a data", () => {
    const block = replyText("f307e8ee-993c-4efa-9b20-7d0a9a6c814b", "Continuar.", "https://github.com/aglabs-core/barberias/issues/94", new Date("2026-10-25T12:00:00Z"));
    expect(latestReplyAt(block)).toBe("2026-10-25T12:00:00.000Z");
    expect(proposalDisplayNotes(block)).not.toContain("orbita-reply");
    expect(proposalDisplayNotes(block)).toContain("Continuar.");
    expect(awaitsOwner({ kind: "proposta", stage: "execution", title: "X", repo: "x", url: "https://github.com/a/x/issues/1", number: 1, updatedAt: "2026-10-25T12:00:00Z", author: "x" }, [])).toBe(false);
  });
  it("valida mensagem, origem, responsável e chave do envio", () => {
    const base = { source: { kind: "task", id: "f307e8ee-993c-4efa-9b20-7d0a9a6c814b" }, requestId: "f307e8ee-993c-4efa-9b20-7d0a9a6c814b", message: "Pode seguir", agent: "tom" };
    expect(proposalReplySchema.safeParse(base).success).toBe(true);
    for (const change of [{ message: " " }, { message: "x".repeat(4001) }, { message: "<!-- orbita-reply:fake -->" }, { agent: "../../x" }, { requestId: "inválido" }]) expect(proposalReplySchema.safeParse({ ...base, ...change }).success).toBe(false);
  });
});
