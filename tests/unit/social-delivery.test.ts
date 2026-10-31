import { describe, expect, it } from "vitest";
import { auditDeliveries, linksIn } from "@/lib/social-delivery";

const byCode = [{ codigo: "PROMPT", mensagem: "Biblioteca: https://aglabs.app.br/prompts" }, { codigo: "LUXO", mensagem: "https://conteudo.aglabs.ia.br/conteudos/luxo" }];
const perPost = [{ codigo: "PROMPT", media_id: "111", mensagem: "Aqui: https://conteudo.aglabs.ia.br/conteudos/bolsa." }];
const kinds = (i: { kind: string }[]) => i.map(x => x.kind);

describe("auditoria de entregas", () => {
  it("extrai links sem pontuação final", () => expect(linksIn("veja https://a.com/x. e https://b.com")).toEqual(["https://a.com/x", "https://b.com"]));
  it("post ok não gera problema", () => expect(auditDeliveries({ perPost, byCode, posts: [{ id: "p", title: "Bolsa", keyword: "prompt", mediaId: "111" }] })).toEqual([]));
  it("post sem linha por post cai no genérico", () => expect(kinds(auditDeliveries({ perPost, byCode, posts: [{ id: "p", title: "Potes", keyword: "PROMPT", mediaId: "222" }] }))).toEqual(["so_fallback"]));
  it("palavra-chave errada", () => expect(kinds(auditDeliveries({ perPost, byCode, posts: [{ id: "p", title: "Bolsa", keyword: "LUXO", mediaId: "111" }] }))).toEqual(["keyword_errada"]));
  it("palavra-chave ausente", () => expect(kinds(auditDeliveries({ perPost, byCode, posts: [{ id: "p", title: "Muse", keyword: "MUSE", mediaId: "9" }] }))).toEqual(["keyword_ausente"]));
  it("linha sem media_id, duplicada e página repetida", () => {
    const rows = [...perPost, { codigo: "PROMPT", media_id: "111", mensagem: "https://conteudo.aglabs.ia.br/conteudos/x" }, { codigo: "X", media_id: "333", mensagem: "https://conteudo.aglabs.ia.br/conteudos/bolsa" }, { codigo: "Y", media_id: "", mensagem: "oi" }];
    expect(kinds(auditDeliveries({ perPost: rows, byCode, posts: [] })).sort()).toEqual(["media_duplicado", "pagina_repetida", "sem_media_id"]);
  });
  it("link quebrado é erro e erros vêm antes de avisos", () => {
    const r = auditDeliveries({ perPost: [], byCode, posts: [{ id: "p", title: "A", keyword: "LUXO" }], linkStatus: { "https://x": 404 } });
    expect(kinds(r)).toEqual(["link_quebrado", "post_sem_media_id"]);
  });
});
