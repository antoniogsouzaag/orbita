import { describe, expect, it, vi } from "vitest";
vi.mock("@/server/vault", () => ({ getVaultIndexSafe: vi.fn() }));
import { getVaultIndexSafe } from "@/server/vault";
import { vpsList } from "@/server/ops";

describe("capacidade dos VPS", () => {
  it.each(["Capacidade atual", "Capacidade", "Recursos de hardware"])("extrai recursos sob %s", async heading => {
    vi.mocked(getVaultIndexSafe).mockResolvedValue({ notes: new Map([["vps.md", { path: "vps.md", title: "VPS-02", frontmatter: { type: "vps" }, body: `## ${heading}\n| Recurso | Capacidade |\n|---|---|\n| CPU | 2 vCPU |\n| RAM | 7.8 GB |` }]]) } as never);
    expect((await vpsList())[0].capacity).toEqual([{ k: "CPU", v: "2 vCPU" }, { k: "RAM", v: "7.8 GB" }]);
  });
});
