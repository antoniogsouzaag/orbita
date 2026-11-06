import { describe, expect, it } from "vitest";
import { buildSchedulePayload, captionToHtml, orderMedia, pickChannel, type PostizChannel } from "@/lib/social-postiz";

const ch = (id: string, identifier: string, name: string, customer?: string, disabled = false): PostizChannel =>
  ({ id, identifier, name, disabled, customer: customer ? { id: customer, name } : null });
const channels = [
  ch("ig-ag", "instagram-standalone", "AG LABS", "8b2560ec-d5c9-4290-9bf7-4b71555ed766"),
  ch("th-ag", "threads", "ag_labs", "8b2560ec-d5c9-4290-9bf7-4b71555ed766"),
  ch("ig-mc", "instagram-standalone", "mecard", "93b212db-9b05-4841-a6ba-e0bcc2c70837"),
  ch("ig-mb", "instagram-standalone", "Members"),
  ch("ig-off", "instagram-standalone", "AG LABS antigo", "8b2560ec-d5c9-4290-9bf7-4b71555ed766", true),
];

describe("agendamento no Postiz", () => {
  it("legenda vira um <p> por linha e linha vazia vira braille", () => {
    expect(captionToHtml("Oi <você>\n\n**Comenta** X")).toBe("<p>Oi &lt;você&gt;</p><p>⠀</p><p>Comenta X</p>");
  });
  it("escolhe o canal da marca na rede certa e nunca o de outra marca", () => {
    expect(pickChannel(channels, "aglabs", "instagram")?.id).toBe("ig-ag");
    expect(pickChannel(channels, "aglabs", "threads")?.id).toBe("th-ag");
    expect(pickChannel(channels, "mecard", "instagram")?.id).toBe("ig-mc");
    expect(pickChannel(channels, "members", "instagram")?.id).toBe("ig-mb");
    expect(pickChannel(channels, "barberias", "instagram")).toBeNull();
  });
  it("payload igual ao do script validado", () => {
    const p = buildSchedulePayload({ channel: channels[0], caption: "a", media: [{ id: "1", path: "x" }], date: new Date("2026-11-02T15:00:00Z"), title: "t" });
    expect(p).toEqual({ type: "schedule", date: "2026-11-02T15:00:00.000Z", shortLink: false, tags: [],
      posts: [{ integration: { id: "ig-ag" }, value: [{ content: "<p>a</p>", image: [{ id: "1", path: "x" }] }], settings: { __type: "instagram-standalone", post_type: "post" } }] });
  });
  it("ordena as mídias pelo número do slide", () => {
    const d = new Date();
    expect(orderMedia([{ filename: "AG-03.jpg", createdAt: d }, { filename: "AG-01.jpg", createdAt: d }, { filename: "AG-02.jpg", createdAt: d }]).map(m => m.filename)).toEqual(["AG-01.jpg", "AG-02.jpg", "AG-03.jpg"]);
  });
});

import { captionFor, fanoutNetworks } from "@/lib/social-postiz";
describe("várias redes por post", () => {
  const cap = "Gancho forte 🚀\n\nParágrafo um.\n\nComenta ARQUIVO que eu te mando\n\n#ia #automacao #negocios #gemini";
  it("AG LABS vai para Instagram, Facebook, LinkedIn e Threads; YouTube só com vídeo", () => {
    expect(fanoutNetworks("aglabs", "instagram", false)).toEqual(["instagram", "facebook", "linkedin", "threads"]);
    expect(fanoutNetworks("aglabs", "instagram", true)).toContain("youtube");
    expect(fanoutNetworks("mecard", "instagram", false)).toEqual(["instagram"]);
  });
  it("fora do Instagram tira o CTA da palavra-chave e usa o link da página", () => {
    const url = "https://conteudo.aglabs.ia.br/conteudos/arquivo";
    expect(captionFor("instagram", cap).content).toContain("Comenta ARQUIVO");
    const fb = captionFor("facebook", cap, { pageUrl: url }).content;
    expect(fb).not.toContain("Comenta ARQUIVO"); expect(fb).toContain(url); expect(fb).not.toContain("#gemini");
    const li = captionFor("linkedin", cap, { pageUrl: url });
    expect(li.content).not.toMatch(/#|🚀|Comenta/); expect(li.comment).toBe(url);
    const th = captionFor("threads", cap + "\n\n" + "x".repeat(600), { pageUrl: url }).content;
    expect(th.length).toBeLessThanOrEqual(500); expect(th).toContain(url);
  });
});

import { mediaForFormat, mediaForNetwork } from "@/lib/social-postiz";
describe("mídias por formato e por rede", () => {
  const rows = [
    { id: "1", contentType: "image/jpeg" },
    { id: "2", contentType: "video/mp4" },
    { id: "3", contentType: "image/jpeg" },
    { id: "layout", contentType: "text/html" },
  ];
  it("carrossel aceita imagens e vídeos; reel só o vídeo; imagem só imagens", () => {
    expect(mediaForFormat("carrossel", rows).map(r => r.id)).toEqual(["1", "2", "3"]);
    expect(mediaForFormat("reels", rows).map(r => r.id)).toEqual(["2"]);
    expect(mediaForFormat("video", rows).map(r => r.id)).toEqual(["2"]);
    expect(mediaForFormat("imagem", rows).map(r => r.id)).toEqual(["1", "3"]);
  });
  it("carrossel misto vai inteiro só no Instagram; nas outras redes seguem as imagens", () => {
    const carrossel = mediaForFormat("carrossel", rows);
    expect(mediaForNetwork("instagram", "carrossel", carrossel).map(r => r.id)).toEqual(["1", "2", "3"]);
    for (const network of ["facebook", "linkedin", "threads"] as const) {
      expect(mediaForNetwork(network, "carrossel", carrossel).map(r => r.id)).toEqual(["1", "3"]);
    }
    expect(mediaForNetwork("linkedin", "carrossel", [rows[1]])).toEqual([]);
  });
  it("reel não muda por rede", () => {
    expect(mediaForNetwork("youtube", "reels", [rows[1]]).map(r => r.id)).toEqual(["2"]);
  });
});
