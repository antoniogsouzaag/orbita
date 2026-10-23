import { describe, expect, it } from "vitest";
import { buildIcs, expandIcs, normalizeIcsUrl } from "@/server/calendar";

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:test
BEGIN:VEVENT
UID:a1
DTSTAMP:20261001T000000Z
DTSTART:20261023T181000Z
DTEND:20261023T191000Z
SUMMARY:Ir fazer a nova identidade
END:VEVENT
BEGIN:VEVENT
UID:r1
DTSTAMP:20261001T000000Z
DTSTART:20261019T110000Z
DTEND:20261019T120000Z
RRULE:FREQ=WEEKLY;COUNT=4
EXDATE:20261026T110000Z
SUMMARY:Treino A
END:VEVENT
BEGIN:VEVENT
UID:d1
DTSTAMP:20261001T000000Z
DTSTART;VALUE=DATE:20261025
DTEND;VALUE=DATE:20261026
SUMMARY:Aniversário
END:VEVENT
END:VCALENDAR`;

describe("ICS", () => {
  it("expande recorrências, aplica EXDATE e trata dia inteiro", () => {
    const evs = expandIcs(ICS, new Date("2026-10-01T00:00:00Z"), new Date("2026-12-31T00:00:00Z"));
    const treinos = evs.filter((e) => e.title === "Treino A");
    expect(treinos).toHaveLength(3);
    expect(new Set(treinos.map((t) => t.uid)).size).toBe(3);
    const aniv = evs.find((e) => e.title === "Aniversário")!;
    expect(aniv.allDay).toBe(true);
    expect(aniv.startAt.toISOString()).toBe("2026-10-25T00:00:00.000Z");
    const id = evs.find((e) => e.uid === "a1")!;
    expect(id.startAt.toISOString()).toBe("2026-10-23T18:10:00.000Z");
  });
  it("gera feed ICS válido com escape e dobra de linha", () => {
    const out = buildIcs([{ uid: "x", title: "Reunião, com; vírgula", startAt: new Date("2026-10-23T18:00:00Z"), endAt: new Date("2026-10-23T19:00:00Z"), allDay: false, description: "a".repeat(120) }]);
    expect(out).toContain("SUMMARY:Reunião\\, com\; vírgula");
    expect(out).toContain("DTSTART:20261023T180000Z");
    expect(out.split("\r\n").every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
    const back = expandIcs(out, new Date("2026-10-01"), new Date("2026-11-01"));
    expect(back[0].title).toBe("Reunião, com; vírgula");
  });
  it("webcal vira https", () => {
    expect(normalizeIcsUrl("webcal://p01-caldav.icloud.com/x")).toBe("https://p01-caldav.icloud.com/x");
  });
});
