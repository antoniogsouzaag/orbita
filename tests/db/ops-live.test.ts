import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { opsEvents, opsStatus } from "@/db/schema";
import { IngestSchema, ingest, liveOps } from "@/server/ops-live";

const run = (links: object[], extra: object = {}) => ingest(IngestSchema.parse({ source: "n8n-vps03", label: "ping my links", everyMinutes: 15, links, ...extra }));

describe("ingestão de status (n8n → Órbita)", () => {
  beforeAll(async () => {
    const db = await getDb();
    await db.delete(opsEvents);
    await db.delete(opsStatus);
  });

  it("confirma queda só na 2ª falha e registra a volta", async () => {
    const url = "https://barberias.com.br/";
    await run([{ url, nome: "Barberias", grupo: "AG LABS", status: 200 }]);
    let s = (await liveOps()).status.find((x) => x.url === url)!;
    expect(s.ok).toBe(true);

    await run([{ url, nome: "Barberias", status: 0, erro: "timeout" }]);
    s = (await liveOps()).status.find((x) => x.url === url)!;
    expect(s).toMatchObject({ ok: true, fails: 1 });
    expect((await liveOps()).events.filter((e) => e.kind === "site_down")).toHaveLength(0);

    await run([{ url, nome: "Barberias", status: 502 }]);
    const live = await liveOps();
    s = live.status.find((x) => x.url === url)!;
    expect(s).toMatchObject({ ok: false, fails: 2, statusCode: 502 });
    expect(live.events.filter((e) => e.kind === "site_down")).toHaveLength(1);

    await run([{ url, nome: "Barberias", status: 503 }]);
    expect((await liveOps()).events.filter((e) => e.kind === "site_down")).toHaveLength(1); // sem duplicar

    await run([{ url, nome: "Barberias", status: 301 }]);
    const after = await liveOps();
    expect(after.status.find((x) => x.url === url)!.ok).toBe(true);
    expect(after.events.find((e) => e.kind === "site_down")!.resolvedAt).not.toBeNull();
    expect(after.events.filter((e) => e.kind === "site_up")).toHaveLength(1);
  });

  it("registra domínios, falhas de workflow e a batida do monitor", async () => {
    await ingest(IngestSchema.parse({ source: "n8n-vps03-dominios", everyMinutes: 60 * 24 * 3, domains: [{ dominio: "AGLABS.IA.BR", depende: "Institucional", expiracao: "2027-01-10T00:00:00Z" }] }));
    await ingest(IngestSchema.parse({ source: "n8n-vps01-erros", workflowError: { workflow: "Comentários do Instagram", node: "HTTP Request", message: "401" } }));
    const live = await liveOps();
    expect(live.domains[0]).toMatchObject({ domain: "aglabs.ia.br", depends: "Institucional" });
    expect(live.events.some((e) => e.kind === "workflow_error" && e.subject === "Comentários do Instagram")).toBe(true);
    const m = live.monitors.find((x) => x.source === "n8n-vps03")!;
    expect(m).toMatchObject({ label: "ping my links", silent: false });
    // alerta avulso de falha não vira "monitor" (não pode acusar silêncio)
    expect(live.monitors.some((x) => x.source === "n8n-vps01-erros")).toBe(false);
    expect(live.monitors.some((x) => x.source === "n8n-vps03-dominios")).toBe(true);
  });

  it("rejeita payload inválido", () => {
    expect(IngestSchema.safeParse({ source: "", links: [{ url: "nao-e-url" }] }).success).toBe(false);
  });
});
