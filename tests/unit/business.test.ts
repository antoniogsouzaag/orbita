import { describe, expect, it } from "vitest";
import { BARBERIAS, belongsToBarberias, groupSocialChannels, preferredSocialChannel, socialGroupId } from "@/lib/business";

describe("entidades do ecossistema", () => {
  it("mantém contas antigas no grupo canônico Barberias, sem adivinhar pelo nome", () => {
    const groups = groupSocialChannels([
      { id: "old", name: "BARBER PRO", customer: { id: BARBERIAS.postizGroupId, name: "Barberro" } },
      { id: "threads", name: "barberiasrv", customer: { id: BARBERIAS.postizGroupId, name: "Barberias" } },
      { id: "other", name: "Barberias" },
    ]);
    expect(groups.find((group) => group.id === BARBERIAS.postizGroupId)).toMatchObject({ name: "Barberias", channels: [{ id: "old" }, { id: "threads" }] });
    expect(groups.find((group) => group.id === "ungrouped")?.channels.map((channel) => channel.id)).toEqual(["other"]);
    expect(socialGroupId("barberias")).toBe(BARBERIAS.postizGroupId);
  });
  it("aceita um grupo novo sem inventar relação com produto", () => {
    expect(groupSocialChannels([{ id: "a", customer: { id: "new", name: "Novo negócio" } }])[0]).toMatchObject({ id: "new", name: "Novo negócio", businessHref: undefined });
  });
  it("restringe o monitoramento ao domínio do produto", () => {
    expect(belongsToBarberias("https://app.barberias.com.br/agenda")).toBe(true);
    expect(belongsToBarberias("https://barberias.com.br.evil.example")).toBe(false);
    expect(belongsToBarberias("https://outro.example/barberias.com.br")).toBe(false);
  });
});

// Explicit channel choices are resolved by the caller; default prioritizes connected Instagram.

it("prefers connected Instagram and falls back to another connected network", () => {
 const facebook = {identifier:"facebook", id:"fb"}, instagram = {identifier:"instagram-standalone", id:"ig"};
 expect(preferredSocialChannel([facebook, instagram])).toBe(instagram);
 expect(preferredSocialChannel([facebook, {...instagram, disabled:true}])).toBe(facebook);
 expect(preferredSocialChannel([])).toBeUndefined();
});
