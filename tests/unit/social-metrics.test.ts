import { describe, expect, it } from "vitest";
import { groupMetrics, headline, summarize } from "@/lib/social-metrics";

const s = (label: string, totals: number[]) => ({ label, data: totals.map((t, i) => ({ total: String(t), date: `2026-10-0${i + 1}` })), percentageChange: 5 });
describe("métricas sociais", () => {
  it("seguidores acumulados usam o último valor; séries diárias somam", () => {
    expect(summarize(s("Followers", [100, 110, 120]), "youtube")).toMatchObject({ value: 120, kind: "ultimo" });
    expect(summarize(s("Reach", [10, 20, 30]), "instagram")).toMatchObject({ value: 60, kind: "soma" });
    expect(summarize(s("Follower Count", [1, 2, 3]), "instagram")).toMatchObject({ value: 6, label: "Novos seguidores" });
  });
  it("agrupa e resume interações", () => {
    const metrics = [s("Likes", [1, 2]), s("Comments", [3]), s("Views", [9]), s("Weird", [1])];
    expect(groupMetrics(metrics, "tiktok").map(g => g.group)).toEqual(["alcance", "interacao", "outros"]);
    expect(headline(metrics, "tiktok", "interacao")?.value).toBe(6);
    expect(headline(metrics, "tiktok", "audiencia")).toBeNull();
  });
  it("ignora valores não numéricos", () => {
    expect(summarize({ label: "Reach", data: [{ total: "", date: "x" }] }, "instagram").value).toBeNull();
  });
});
