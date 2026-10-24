import { describe, expect, it } from "vitest";
import { parseImageDataUrl } from "@/lib/image-data";
import { agentSlug, agoLabel } from "@/lib/team";

const png = Buffer.concat([Buffer.from("\x89PNG\r\n\x1a\n", "latin1"), Buffer.alloc(16)]).toString("base64");
const webp = Buffer.concat([Buffer.from("RIFF\0\0\0\0WEBP", "latin1"), Buffer.alloc(16)]).toString("base64");

describe("foto do agente", () => {
  it("aceita PNG e WebP com assinatura real", () => {
    expect(parseImageDataUrl(`data:image/png;base64,${png}`)).toMatchObject({ ok: true, type: "image/png" });
    expect(parseImageDataUrl(`data:image/webp;base64,${webp}`)).toMatchObject({ ok: true, type: "image/webp" });
  });

  it("recusa tipo declarado diferente dos bytes, SVG e texto", () => {
    expect(parseImageDataUrl(`data:image/jpeg;base64,${png}`)).toMatchObject({ ok: false });
    expect(parseImageDataUrl("data:image/svg+xml;base64,PHN2Zz4=")).toMatchObject({ ok: false });
    expect(parseImageDataUrl("não é imagem")).toMatchObject({ ok: false });
    expect(parseImageDataUrl(null)).toMatchObject({ ok: false });
  });

  it("recusa imagens grandes demais", () => {
    const big = Buffer.concat([Buffer.from("\x89PNG\r\n\x1a\n", "latin1"), Buffer.alloc(450_000)]).toString("base64");
    expect(parseImageDataUrl(`data:image/png;base64,${big}`)).toMatchObject({ ok: false, error: "Imagem grande demais" });
  });
});

describe("identificador do agente", () => {
  it("normaliza acentos, espaços e símbolos", () => {
    expect(agentSlug("Léo")).toBe("leo");
    expect(agentSlug("Tom-Órbita")).toBe("tom-orbita");
    expect(agentSlug("  Íris  Bot ")).toBe("iris-bot");
  });

  it("descreve o tempo desde a última atividade", () => {
    const now = Date.parse("2026-10-24T12:00:00Z");
    expect(agoLabel(null, now)).toBeNull();
    expect(agoLabel("2026-10-24T11:59:40Z", now)).toBe("agora");
    expect(agoLabel("2026-10-24T11:20:00Z", now)).toBe("há 40 min");
    expect(agoLabel("2026-10-24T09:00:00Z", now)).toBe("há 3 h");
    expect(agoLabel("2026-10-20T12:00:00Z", now)).toBe("há 4 dias");
  });
});
