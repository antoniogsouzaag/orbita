import { describe, expect, it } from "vitest";
import { arrangeTimeBlocks, eventFormSchema, eventRange, isCalendarDate, isCalendarMonth } from "@/lib/calendar";

describe("datas e horários da agenda", () => {
  it("recusa datas inexistentes e meses fora do calendário", () => {
    expect(isCalendarDate("2026-02-29")).toBe(false);
    expect(isCalendarDate("2028-02-29")).toBe(true);
    expect(isCalendarDate("2026-04-31")).toBe(false);
    expect(isCalendarMonth("2026-13")).toBe(false);
    expect(isCalendarMonth("2026-00")).toBe(false);
    expect(isCalendarMonth("2026-10")).toBe(true);
  });

  it("recusa fim antes do início e horários inválidos", () => {
    const event = { title: "Planejamento", date: "2026-10-23", startTime: "09:00", endTime: "10:00" };
    expect(eventFormSchema.safeParse({ ...event, endDate: "2026-10-22" }).success).toBe(false);
    expect(eventFormSchema.safeParse({ ...event, endTime: "08:59" }).success).toBe(false);
    expect(eventFormSchema.safeParse({ ...event, startTime: "25:00" }).success).toBe(false);
    expect(eventFormSchema.safeParse({ ...event, endDate: "2026-10-24", endTime: "00:00" }).success).toBe(true);
  });

  it("mantém meia-noite do dia seguinte e converte o fuso do aplicativo", () => {
    const range = eventRange(eventFormSchema.parse({ title: "Publicação", date: "2026-10-23", endDate: "2026-10-24", startTime: "23:00", endTime: "00:00" }));
    expect(range.startAt.toISOString()).toBe("2026-10-24T02:00:00.000Z");
    expect(range.endAt.toISOString()).toBe("2026-10-24T03:00:00.000Z");
    expect(range.allDay).toBe(false);
  });

  it("mantém dia inteiro sem deslocamento de fuso e fim exclusivo", () => {
    const range = eventRange(eventFormSchema.parse({ title: "Revisão", date: "2026-10-23", endDate: "2026-10-25", allDay: true }));
    expect(range.startAt.toISOString()).toBe("2026-10-23T00:00:00.000Z");
    expect(range.endAt.toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });
});

describe("sobreposição de compromissos", () => {
  it("separa conflitos em colunas e libera toda a largura após o grupo", () => {
    const blocks = arrangeTimeBlocks([
      { id: "depois", startMinute: 780, endMinute: 840 },
      { id: "reuniao", startMinute: 540, endMinute: 660 },
      { id: "tarefa", startMinute: 600, endMinute: 630 },
      { id: "cliente", startMinute: 615, endMinute: 720 },
    ]);
    expect(blocks.find((block) => block.id === "reuniao")).toMatchObject({ lane: 0, lanes: 3 });
    expect(blocks.find((block) => block.id === "tarefa")).toMatchObject({ lane: 1, lanes: 3 });
    expect(blocks.find((block) => block.id === "cliente")).toMatchObject({ lane: 2, lanes: 3 });
    expect(blocks.find((block) => block.id === "depois")).toMatchObject({ lane: 0, lanes: 1 });
  });

  it("horários adjacentes não são conflitos", () => {
    const blocks = arrangeTimeBlocks([{ id: "a", startMinute: 540, endMinute: 600 }, { id: "b", startMinute: 600, endMinute: 660 }]);
    expect(blocks.map((block) => block.lanes)).toEqual([1, 1]);
  });
});
