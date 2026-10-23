import { describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { focusSessions } from "@/db/schema";
vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { logFocus } from "@/app/actions/life";

describe("sessões de foco idempotentes", () => {
  it("um retry da mesma sessão não duplica minutos", async () => {
    const db = await getDb(); await db.delete(focusSessions);
    const id = "a72725bb-4c0e-45bb-8ba9-cc85c77fedac";
    expect(await logFocus(3, "Foco parcial", null, id)).toEqual({ recorded: true });
    expect(await logFocus(3, "Foco parcial", null, id)).toEqual({ recorded: false });
    expect(await db.select().from(focusSessions)).toHaveLength(1);
  });
});
