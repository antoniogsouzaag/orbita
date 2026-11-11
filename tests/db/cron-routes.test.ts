import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/social-media", () => ({ cleanupSocialMedia: vi.fn(async () => ({ removed: 0 })) }));
vi.mock("@/server/social-publish", () => ({ syncScheduledPosts: vi.fn(async () => ({ synced: 0 })) }));

import { GET as midia } from "@/app/api/cron/midia/route";
import { GET as redes } from "@/app/api/cron/redes/route";
import { cleanupSocialMedia } from "@/server/social-media";
import { cronRuns } from "@/server/cron-runs";

const SECRET = "segredo-de-teste-0123456789";
const call = (path: string, authorization?: string) => new Request(`http://orbita.test${path}`, { headers: authorization ? { authorization } : {} });

beforeEach(() => { vi.stubEnv("CRON_SECRET", SECRET); });
afterEach(() => { vi.unstubAllEnvs(); });

describe("rotas das rotinas diárias", () => {
  it("aceitam o cabeçalho Bearer do agendador, executam e registram", async () => {
    const res = await midia(call("/api/cron/midia?agendado=1", `Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, removed: 0 });
    expect((await cronRuns()).midia).toMatchObject({ ok: true, status: 200 });
  });

  it("recusam sem segredo, com segredo errado ou sem o prefixo esperado", async () => {
    vi.mocked(cleanupSocialMedia).mockClear();
    for (const header of [undefined, "Bearer errado-0123456789abcdef", `Basic ${SECRET}`]) {
      expect((await midia(call("/api/cron/midia", header))).status).toBe(401);
      expect((await redes(call("/api/cron/redes", header))).status).toBe(401);
    }
    expect(cleanupSocialMedia).not.toHaveBeenCalled();
  });
});
