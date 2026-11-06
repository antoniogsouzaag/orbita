import { describe, expect, it } from "vitest";
import { isLayout, layoutFonts, parseTranslate, sanitizeLayout, slideCount, slideFileNames, toHex } from "@/lib/social-layout";

describe("layout do post", () => {
  it("tira scripts, handlers e links javascript", () => {
    const html = `<div class="slide" id="s1" onclick="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">x</a><iframe src="https://x"></iframe><img src="a.jpg" onerror='alert(4)'></div>`;
    const out = sanitizeLayout(html);
    expect(out).not.toMatch(/alert|<script|<iframe|onclick|onerror/i);
    expect(out).toContain('<img src="a.jpg">');
    expect(out).toContain('id="s1"');
  });

  it("mantém CSS e imagens embutidas", () => {
    const html = `<style>.big{font:800 178px/.9 "Manrope"}</style><img src="data:image/png;base64,AAAA">`;
    expect(sanitizeLayout(html)).toBe(html);
  });

  it("lista as fontes do Google Fonts e do CSS", () => {
    const html = `<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@500;600&amp;family=Manrope:wght@600;800&display=swap" rel="stylesheet"><style>.x{font:600 26px/1.3 "Plus Jakarta Sans"}.y{font-family:'Manrope'}</style>`;
    expect(layoutFonts(html)).toEqual(["Source Serif 4", "Manrope", "Plus Jakarta Sans"]);
  });

  it("conta slides pela regra do render.mjs", () => {
    expect(slideCount(`<div id="s1"></div><div id='s2'></div><div id="sx"></div>`)).toBe(2);
  });

  it("reaproveita o nome dos slides já enviados", () => {
    expect(slideFileNames(2, ["capa.jpg", "AGLABS-rotinas-01.jpg", "AGLABS-rotinas-02.jpg"])).toEqual(["AGLABS-rotinas-01.jpg", "AGLABS-rotinas-02.jpg"]);
    expect(slideFileNames(1, ["video.mp4"])).toEqual(["layout-01.jpg"]);
  });

  it("converte cor e deslocamento", () => {
    expect(toHex("rgb(255, 106, 0)")).toBe("#ff6a00");
    expect(toHex("rgba(0, 0, 0, 0)")).toBeNull();
    expect(toHex("#ABCDEF")).toBe("#abcdef");
    expect(parseTranslate("12px -4px")).toEqual([12, -4]);
    expect(parseTranslate("")).toEqual([0, 0]);
  });

  it("reconhece o tipo do layout", () => {
    expect(isLayout("text/html; charset=utf-8")).toBe(true);
    expect(isLayout("image/jpeg")).toBe(false);
  });
});
