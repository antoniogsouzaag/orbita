import { format, isValid, parseISO } from "date-fns";
import { z } from "zod";
import { shiftDate, zonedToUtc } from "@/lib/dates";

export type CalendarView = "mes" | "semana" | "dia" | "agenda";

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseISO(value);
  return isValid(date) && format(date, "yyyy-MM-dd") === value;
}

export function isCalendarMonth(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value) && isCalendarDate(`${value}-01`);
}

const date = z.string().refine(isCalendarDate, "Escolha uma data válida");
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Escolha um horário válido");

export const eventFormSchema = z.object({
  title: z.string().trim().min(1, "Informe o título").max(300),
  date,
  endDate: date.nullable().optional(),
  startTime: time.nullable().optional(),
  endTime: time.nullable().optional(),
  allDay: z.boolean().optional(),
  location: z.string().max(300).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
}).superRefine((value, ctx) => {
  const endDate = value.endDate ?? value.date;
  if (endDate < value.date) ctx.addIssue({ code: "custom", path: ["endDate"], message: "O fim deve ser no início ou depois dele" });
  if (!value.allDay && value.startTime && value.endTime && endDate === value.date && value.endTime <= value.startTime) {
    ctx.addIssue({ code: "custom", path: ["endTime"], message: "O horário final deve ser depois do início" });
  }
});

export function eventRange(value: z.infer<typeof eventFormSchema>) {
  if (value.allDay || !value.startTime) {
    return { startAt: new Date(`${value.date}T00:00:00Z`), endAt: new Date(`${shiftDate(value.endDate ?? value.date, 1)}T00:00:00Z`), allDay: true };
  }
  const startAt = zonedToUtc(value.date, value.startTime);
  const endAt = value.endTime ? zonedToUtc(value.endDate ?? value.date, value.endTime) : new Date(startAt.getTime() + 3_600_000);
  return { startAt, endAt, allDay: false };
}

/** Assign overlapping commitments to separate lanes instead of covering each other. */
export function arrangeTimeBlocks<T extends { id: string; startMinute: number; endMinute: number }>(blocks: T[]): (T & { lane: number; lanes: number })[] {
  const result: (T & { lane: number; lanes: number })[] = [];
  let cluster: (T & { lane: number; lanes: number })[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    for (const block of cluster) result.push({ ...block, lanes: laneEnds.length });
    cluster = [];
    laneEnds = [];
  };
  for (const block of [...blocks].sort((a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute)) {
    if (block.startMinute >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= block.startMinute);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = block.endMinute;
    cluster.push({ ...block, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, block.endMinute);
  }
  flush();
  return result;
}
