import { describe, expect, it } from "vitest";
import { captionToHtml, mediaKey, orderMedia, planMedia, sameCaption, versionlessName } from "@/lib/social-postiz";
import { RateWindow, retryAfterMs } from "@/lib/rate-window";

const row = (id: string, filename: string, contentType = "image/jpeg", min = 0) => ({ id, filename, contentType, createdAt: new Date(Date.UTC(2026, 10, 15, 12, min)) });

describe("versão de mídia", () => {
  it("v2 no começo, no fim ou no meio é o mesmo slide", () => {
    expect(versionlessName("v2-AGLABS-app-01.jpg")).toBe("aglabs-app-01");
    expect(versionlessName("AGLABS-app-01-v2.jpg")).toBe("aglabs-app-01");
    expect(versionlessName("AGLABS-app-v3-01.png")).toBe("aglabs-app-01");
    expect(versionlessName("AGLABS-mundos-v2.mp4")).toBe("aglabs-mundos");
    // Imagem e vídeo com o mesmo nome são peças diferentes.
    expect(mediaKey("a-01.jpg", "image/jpeg")).not.toBe(mediaKey("a-01.mp4", "video/mp4"));
    expect(mediaKey("a-01.jpg", "image/jpeg")).toBe(mediaKey("a-01.png", "image/png"));
  });
  it("o 2 do v2 não vira número de slide", () => {
    const out = orderMedia([row("b", "x-v2.jpg", "image/jpeg", 1), row("a", "x-01.jpg")]);
    expect(out.map(r => r.id)).toEqual(["a", "b"]);
  });
});

describe("plano de mídias", () => {
  it("reenvio com v2 substitui, não soma (o caso dos 17 slides)", () => {
    const rows = [
      ...Array.from({ length: 9 }, (_, i) => row(`o${i}`, `AGLABS-app-${String(i + 1).padStart(2, "0")}.jpg`, "image/jpeg", 0)),
      ...Array.from({ length: 8 }, (_, i) => row(`n${i}`, `v2-AGLABS-app-${String(i + 1).padStart(2, "0")}.jpg`, "image/jpeg", 5)),
    ];
    const plan = planMedia("carrossel", rows);
    expect(plan.active).toHaveLength(9);
    expect(plan.active.slice(0, 8).every(r => r.id.startsWith("n"))).toBe(true);
    expect(plan.active[8].id).toBe("o8");
    expect(plan.superseded).toHaveLength(8);
    expect(plan.issues).toEqual([]);
  });
  it("reel com v1 e v2 vai só com o mais recente; dois vídeos diferentes bloqueiam", () => {
    expect(planMedia("reels", [row("v1", "AGLABS-mundos.mp4", "video/mp4"), row("v2", "AGLABS-mundos-v2.mp4", "video/mp4", 3), row("c", "capa.jpg")]).active.map(r => r.id)).toEqual(["v2"]);
    expect(planMedia("reels", [row("a", "reel-a.mp4", "video/mp4"), row("b", "reel-b.mp4", "video/mp4")]).issues[0]).toMatch(/único vídeo: há 2/);
    expect(planMedia("reels", [row("c", "capa.jpg")]).issues[0]).toMatch(/MP4/);
  });
  it("mais de 10 mídias bloqueia com quantas tirar", () => {
    const rows = Array.from({ length: 12 }, (_, i) => row(`s${i}`, `slide-${String(i + 1).padStart(2, "0")}.jpg`));
    expect(planMedia("carrossel", rows).issues).toEqual(["12 mídias; o Instagram aceita até 10. Remova 2."]);
  });
});

describe("legenda que saiu direto pelo Postiz", () => {
  const caption = "**Seu app** pronto em 7 dias.\n\nComenta APP que eu te mando o passo a passo & o modelo.";
  it("reconhece o HTML que o Postiz guarda", () => expect(sameCaption(captionToHtml(caption), caption)).toBe(true));
  it("não confunde legenda diferente nem texto curto demais", () => {
    expect(sameCaption(captionToHtml("Outro post sobre outra coisa, com outro texto."), caption)).toBe(false);
    expect(sameCaption("<p>Oi</p>", "Oi")).toBe(false);
  });
});

describe("limite do Postiz", () => {
  it("conta na janela de uma hora e diz quando cabe", () => {
    const w = new RateWindow(3, 3_600_000);
    w.record(0); w.record(10_000); w.record(20_000);
    expect(w.state(30_000).remaining).toBe(0);
    expect(w.availableAt(1, 30_000)).toBe(3_600_000);
    expect(w.availableAt(2, 30_000)).toBe(3_610_000);
    expect(w.availableAt(4, 30_000)).toBeNull();
    expect(w.state(3_600_001).remaining).toBe(1);
    w.block(5_000_000);
    expect(w.state(4_000_000).blockedUntil).toBe(5_000_000);
    expect(w.availableAt(1, 4_000_000)).toBe(5_000_000);
  });
  it("lê Retry-After em segundos ou data e X-RateLimit-Reset", () => {
    expect(retryAfterMs(new Headers({ "retry-after": "12" }))).toBe(12_000);
    expect(retryAfterMs(new Headers({ "Retry-After": new Date(70_000).toUTCString() }), 10_000)).toBe(60_000);
    expect(retryAfterMs(new Headers({ "x-ratelimit-reset": "900" }))).toBe(900_000);
    expect(retryAfterMs(new Headers())).toBeNull();
  });
});
