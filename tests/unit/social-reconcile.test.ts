import { describe, expect, it } from "vitest";
import { channelIdentity, reconcileExternal, type PostizChannel } from "@/lib/social-postiz";

const ch = (id: string, name: string, identifier = "instagram-standalone", customer: PostizChannel["customer"] = null): PostizChannel => ({ id, name, identifier, customer });

describe("conciliação Postiz", () => {
  const channels = [ch("c1", "mecard.app", "instagram-standalone", { id: "93b212db-9b05-4841-a6ba-e0bcc2c70837", name: "Mecard" }), ch("c2", "Barberias", "tiktok"), ch("c3", "Pessoal")];
  it("descobre marca e rede do canal", () => {
    expect(channelIdentity(channels[0])).toEqual({ brand: "mecard", network: "instagram" });
    expect(channelIdentity(channels[1])).toEqual({ brand: "barberias", network: "tiktok" });
    expect(channelIdentity(channels[2])).toBeNull();
  });
  it("traz só posts externos válidos", () => {
    const out = reconcileExternal([
      { id: "a", publishDate: "2026-11-08T23:00:00Z", integration: { id: "c1" }, content: "<p>Oi</p><p>mundo</p>", state: "QUEUE" },
      { id: "b", publishDate: "2026-11-08T23:00:00Z", integration: { id: "c1" } },
      { id: "c", publishDate: "2026-11-08T23:00:00Z", integration: { id: "c2" }, state: "ERROR" },
      { id: "d", publishDate: "2026-11-08T23:00:00Z", integration: { id: "c3" } },
      { id: "e", publishDate: "2026-11-07T23:00:00Z", integrationId: "c2", state: "PUBLISHED", releaseURL: "https://x" },
    ], channels, new Set(["b"]));
    expect(out.map(o => o.id)).toEqual(["postiz:a", "postiz:e"]);
    expect(out[0]).toMatchObject({ brand: "mecard", stage: "agendado", title: "Oi mundo" });
    expect(out[1]).toMatchObject({ brand: "barberias", stage: "publicado", publishedUrl: "https://x" });
  });
});

import { dueCrons } from "@/lib/internal-cron";
describe("agendador interno", () => {
  it("roda cada rota uma vez na janela do horário", () => {
    const ran = new Set<string>();
    const at = new Date("2026-11-06T03:16:00Z");
    const first = dueCrons(at, ran);
    expect(first.map(j => j.path)).toEqual(["/api/cron/redes"]);
    first.forEach(j => ran.add(j.key));
    expect(dueCrons(new Date("2026-11-06T03:17:00Z"), ran)).toEqual([]);
    expect(dueCrons(new Date("2026-11-06T04:00:00Z"), new Set())).toEqual([]);
  });
});
