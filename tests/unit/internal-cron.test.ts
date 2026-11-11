import { describe, expect, it } from "vitest";
import { dueCrons, internalCronEnabled, lateCrons, scheduledAt } from "@/lib/internal-cron";
import { buildCommit, sameCommit } from "@/lib/build-info";

describe("agendador interno", () => {
  it("dispara cada rotina uma vez e recupera a que perdeu o horário dentro da janela", () => {
    const done = new Set<string>();
    const first = dueCrons(new Date("2026-11-06T03:16:00Z"), done);
    expect(first.map((j) => j.path)).toEqual(["/api/cron/redes"]);
    first.forEach((j) => done.add(j.key));
    expect(dueCrons(new Date("2026-11-06T03:17:00Z"), done)).toEqual([]);
    // servidor voltou 45 min depois do horário: a rotina ainda roda
    expect(dueCrons(new Date("2026-11-06T04:00:00Z"), new Set()).map((j) => j.job)).toEqual(["redes"]);
    // antes do horário e depois da janela de 3 h, nada
    expect(dueCrons(new Date("2026-11-06T03:14:00Z"), new Set())).toEqual([]);
    expect(dueCrons(new Date("2026-11-06T13:01:00Z"), new Set())).toEqual([]);
    // o que rodou ontem não bloqueia hoje
    expect(dueCrons(new Date("2026-11-07T03:16:00Z"), done).map((j) => j.key)).toEqual(["redes@2026-11-07"]);
  });

  it("marca o horário no dia UTC", () => {
    expect(scheduledAt("brief", new Date("2026-11-06T23:59:00Z")).toISOString()).toBe("2026-11-06T10:00:00.000Z");
  });

  it("liga sozinho só em produção fora da Vercel e com segredo; a variável explícita vence", () => {
    const prod = { NODE_ENV: "production", CRON_SECRET: "0123456789abcdef" };
    expect(internalCronEnabled(prod)).toBe(true);
    expect(internalCronEnabled({ ...prod, VERCEL: "1" })).toBe(false);
    expect(internalCronEnabled({ ...prod, CRON_SECRET: "" })).toBe(false);
    expect(internalCronEnabled({ ...prod, NODE_ENV: "development" })).toBe(false);
    expect(internalCronEnabled({ ...prod, ORBITA_INTERNAL_CRON: "0" })).toBe(false);
    expect(internalCronEnabled({ ORBITA_INTERNAL_CRON: "1" })).toBe(true);
  });

  it("aponta rotina sem registro, falhada ou parada há mais de 26 h", () => {
    const now = new Date("2026-11-06T12:00:00Z");
    const fresh = { at: "2026-11-06T10:00:00.000Z", ok: true, status: 200, lastOkAt: "2026-11-06T10:00:00.000Z" };
    expect(lateCrons({ redes: fresh, orbe: fresh, midia: fresh, brief: fresh }, now)).toEqual([]);
    const late = lateCrons({
      redes: fresh,
      orbe: { at: "2026-11-06T06:00:00.000Z", ok: false, status: 502, lastOkAt: "2026-11-04T06:00:00.000Z" },
      midia: { at: "2026-11-04T07:30:00.000Z", ok: true, status: 200, lastOkAt: "2026-11-04T07:30:00.000Z" },
    }, now);
    expect(late).toEqual([
      "Memória da ORBE: falhou em 2026-11-06T06:00:00.000Z (HTTP 502)",
      "Limpeza de mídias: última em 2026-11-04T07:30:00.000Z",
      "Bom dia: sem execução registrada",
    ]);
  });
});

describe("versão publicada", () => {
  it("só aceita commit válido e compara curto com completo", () => {
    delete process.env.ORBITA_COMMIT;
    expect(buildCommit()).toBeNull();
    process.env.ORBITA_COMMIT = "edd0c0e1234567890abcdef1234567890abcdef1";
    expect(buildCommit()).toBe("edd0c0e");
    process.env.ORBITA_COMMIT = "HEAD";
    expect(buildCommit()).toBeNull();
    delete process.env.ORBITA_COMMIT;
    expect(sameCommit("edd0c0e", "edd0c0e1234567890abcdef1234567890abcdef1")).toBe(true);
    expect(sameCommit("edd0c0e", "b8f0a821234567890abcdef1234567890abcdef1")).toBe(false);
    expect(sameCommit("edd", "edd0c0e")).toBe(false);
  });
});
