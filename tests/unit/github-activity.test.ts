import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
import { githubActivity } from "@/server/github";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("calendário GitHub", () => {
  it("ignora token geral vazio e usa o dedicado sem expor segredos", async () => {
    vi.stubEnv("GITHUB_USER", "owner"); vi.stubEnv("GITHUB_TOKEN", ""); vi.stubEnv("GITHUB_INBOX_TOKEN", "dedicated-secret");
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      expect(init.headers.authorization).toBe("Bearer dedicated-secret");
      return Response.json({ data: { user: { contributionsCollection: { contributionCalendar: { weeks: [{ contributionDays: [{ date: "2026-10-23", contributionCount: 4 }] }] } } } } });
    }));
    const result = await githubActivity({ force: true });
    expect(result).toMatchObject({ error: null, days: [{ count: 4 }] });
    expect(JSON.stringify(result)).not.toContain("dedicated-secret");
  });
  it("limite GraphQL não vira calendário vazio e uma tentativa seguinte recupera", async () => {
    vi.stubEnv("GITHUB_USER", "owner"); vi.stubEnv("GITHUB_TOKEN", "secret");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ errors: [{ type: "RATE_LIMITED" }] })));
    expect((await githubActivity()).error).toContain("limite");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("secret in transport"); }));
    expect(JSON.stringify(await githubActivity({ force: true }))).not.toContain("secret");
  });
});
