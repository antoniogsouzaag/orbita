import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cronRuns, runCron } from "@/server/cron-runs";

const SECRET = "segredo-de-teste-0123456789";
const call = (query = "", token = SECRET) => new Request(`http://orbita.test/api/cron/x${query}`, { headers: { authorization: `Bearer ${token}` } });

beforeEach(() => { vi.stubEnv("CRON_SECRET", SECRET); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("registro das rotinas diárias", () => {
  it("recusa sem o segredo e não executa nem registra", async () => {
    const work = vi.fn(async () => ({ body: { ok: true } }));
    const res = await runCron(call("", "errado-0123456789abcdef"), "midia", work);
    expect(res.status).toBe(401);
    expect(work).not.toHaveBeenCalled();
    expect((await cronRuns()).midia).toBeUndefined();
  });

  it("registra sucesso e falha sem guardar a mensagem de erro, preservando o último sucesso", async () => {
    const ok = await runCron(call(), "redes", async () => ({ body: { ok: true, synced: 2 } }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true, synced: 2 });
    const first = (await cronRuns()).redes!;
    expect(first).toMatchObject({ ok: true, status: 200 });
    expect(first.lastOkAt).toBe(first.at);

    const failed = await runCron(call(), "redes", async () => { throw new Error("https://privado.example/?token=abc"); });
    expect(failed.status).toBe(502);
    const second = (await cronRuns()).redes!;
    expect(second).toMatchObject({ ok: false, status: 502, lastOkAt: first.lastOkAt });
    expect(JSON.stringify(second)).not.toContain("privado");
  });

  it("o agendador não repete a rotina que já terminou bem hoje; a chamada manual repete", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-06T10:01:00Z"));
    const work = vi.fn(async () => ({ body: { ok: true } }));
    await runCron(call("?agendado=1"), "brief", work);
    expect(work).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-11-06T10:20:00Z"));
    const again = await runCron(call("?agendado=1"), "brief", work);
    expect(await again.json()).toEqual({ ok: true, skipped: true, reason: "already_ran" });
    expect(work).toHaveBeenCalledTimes(1);

    await runCron(call(), "brief", work);
    expect(work).toHaveBeenCalledTimes(2);

    vi.setSystemTime(new Date("2026-11-07T10:01:00Z"));
    await runCron(call("?agendado=1"), "brief", work);
    expect(work).toHaveBeenCalledTimes(3);
  });

  it("falha de hoje não impede a nova tentativa do agendador", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-06T06:01:00Z"));
    const work = vi.fn(async () => ({ status: 502, retryable: true, body: { ok: false } }));
    await runCron(call("?agendado=1"), "orbe", work);
    await runCron(call("?agendado=1"), "orbe", work);
    expect(work).toHaveBeenCalledTimes(2);
  });

  it("reserva atomicamente e impede repetição quando o efeito ficou incerto", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-08T10:01:00Z"));
    const work = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
      return { status: 502, body: { ok: false } };
    });
    await Promise.all([runCron(call("?agendado=1"), "brief", work), runCron(call("?agendado=1"), "brief", work)]);
    await runCron(call("?agendado=1"), "brief", work);
    expect(work).toHaveBeenCalledTimes(1);
  });
});
