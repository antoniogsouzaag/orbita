import { describe, expect, it } from "vitest";
import { availabilitySnapshot } from "@/lib/ops-freshness";

describe("atualidade dos resultados de disponibilidade", () => {
  it("separa resposta recente de alvo antigo, monitor silencioso e fonte desconhecida", () => {
    const now = Date.parse("2026-10-28T17:00:00Z");
    const monitor = [{ source: "normal", silent: false, everyMinutes: 15 }, { source: "silencioso", silent: true, everyMinutes: 15 }];
    const status = [
      { source: "normal", checkedAt: new Date(now - 15 * 60_000), ok: true },
      { source: "normal", checkedAt: new Date(now - 50 * 60_000), ok: true },
      { source: "normal", checkedAt: new Date(now - 5 * 60_000), ok: false },
      { source: "silencioso", checkedAt: new Date(now - 5 * 60_000), ok: true },
      { source: "sem-batida", checkedAt: new Date(now), ok: true },
    ];
    const result = availabilitySnapshot(status, monitor, now);
    expect(result.current).toEqual([status[0], status[2]]);
    expect(result.up).toEqual([status[0]]);
    expect(result.down).toEqual([status[2]]);
    expect(result.stale).toEqual([status[1], status[3], status[4]]);
  });

  it("usa a janela do monitor e não considera datas inválidas ou futuras como recentes", () => {
    const now = Date.parse("2026-10-28T17:00:00Z");
    const monitor = [{ source: "dominios", silent: false, everyMinutes: 60 * 24 * 3 }];
    const status = [
      { source: "dominios", checkedAt: new Date(now - 7 * 86_400_000), ok: true },
      { source: "dominios", checkedAt: new Date(now + 1), ok: true },
      { source: "dominios", checkedAt: new Date("invalid"), ok: true },
    ];
    expect(availabilitySnapshot(status, monitor, now).current).toEqual([status[0]]);
    expect(availabilitySnapshot(status, monitor, now).stale).toEqual(status.slice(1));
  });
});
