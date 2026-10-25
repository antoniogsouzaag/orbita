import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { opsEvents } from "@/db/schema";
const auth = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/auth", () => ({ requireAuth: auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { resolveIncidentAction } from "@/app/actions/incidents";

describe("encerramento verificado de incidentes", () => {
  it("exige sessão e evidência, preserva detalhes e não resolve indisponibilidade de site", async () => {
    const db = await getDb();
    const [event] = await db.insert(opsEvents).values({ kind: "workflow_error", severity: "warning", source: "test", subject: "fixture", detail: { executionUrl: "https://n8n.example/executions/1" } }).returning();
    await expect(resolveIncidentAction({ id: event.id, evidence: "curta" })).rejects.toThrow();
    auth.mockRejectedValueOnce(new Error("unauthorized"));
    await expect(resolveIncidentAction({ id: event.id, evidence: "Verificado em teste controlado" })).rejects.toThrow("unauthorized");
    await resolveIncidentAction({ id: event.id, evidence: "Verificado em teste controlado" });
    const [resolved] = await db.select().from(opsEvents).where(eq(opsEvents.id, event.id));
    expect(resolved.resolvedAt).not.toBeNull();
    expect(resolved.detail).toMatchObject({ executionUrl: "https://n8n.example/executions/1", resolution: "Verificado em teste controlado" });
    await resolveIncidentAction({ id: event.id, evidence: "Outra evidência não deve sobrescrever" });
    expect((await db.select().from(opsEvents).where(eq(opsEvents.id, event.id)))[0].detail.resolution).toBe("Verificado em teste controlado");
    const [site] = await db.insert(opsEvents).values({ kind: "site_down", severity: "critical", source: "test", subject: "site" }).returning();
    await resolveIncidentAction({ id: site.id, evidence: "Site só resolve pela coleta real" });
    expect((await db.select().from(opsEvents).where(eq(opsEvents.id, site.id)))[0].resolvedAt).toBeNull();
  });
});
