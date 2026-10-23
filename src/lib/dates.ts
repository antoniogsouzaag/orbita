import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const TIMEZONE = process.env.APP_TIMEZONE ?? process.env.NEXT_PUBLIC_APP_TIMEZONE ?? "America/Sao_Paulo";

/** Data local (YYYY-MM-DD) no fuso do app, independente do fuso do servidor. */
export function localDate(d: Date = new Date(), tz = TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Hora local (0-23) no fuso do app. */
export function localHour(d: Date = new Date(), tz = TIMEZONE): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(d));
}

/** HH:mm no fuso do app. */
export function localTime(d: Date, tz = TIMEZONE): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}

export function today(): string {
  return localDate();
}

/** Soma dias a uma data YYYY-MM-DD. */
export function shiftDate(iso: string, days: number): string {
  return format(addDays(parseISO(iso), days), "yyyy-MM-dd");
}

/** Dia da semana (0=domingo) de uma data YYYY-MM-DD. */
export function weekday(iso: string): number {
  return parseISO(iso).getDay();
}

export function daysBetween(a: string, b: string): number {
  return differenceInCalendarDays(parseISO(b), parseISO(a));
}

/** Segunda-feira da semana da data. */
export function startOfWeekISO(iso: string): string {
  const wd = weekday(iso);
  return shiftDate(iso, wd === 0 ? -6 : 1 - wd);
}

export function lastNDays(n: number, end = today()): string[] {
  return Array.from({ length: n }, (_, i) => shiftDate(end, i - n + 1));
}

/**
 * Converte data + hora locais (do fuso do app) em Date UTC.
 * Usa o deslocamento do fuso naquele instante (lida com horário de verão).
 */
export function zonedToUtc(dateISO: string, time = "00:00", tz = TIMEZONE): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = tzOffsetMinutes(new Date(guess), tz);
  const first = guess - offset * 60_000;
  const offset2 = tzOffsetMinutes(new Date(first), tz);
  return new Date(guess - offset2 * 60_000);
}

function tzOffsetMinutes(d: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - d.getTime()) / 60_000);
}

/** "Hoje", "Amanhã", "Ontem", "qua", "7 de out". */
export function relativeDay(iso: string, ref = today()): string {
  const diff = daysBetween(ref, iso);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  if (diff > 1 && diff < 7) return format(parseISO(iso), "EEE", { locale: ptBR });
  return format(parseISO(iso), "d 'de' MMM", { locale: ptBR });
}

export function formatLong(iso: string): string {
  return format(parseISO(iso), "EEEE, d 'de' MMMM", { locale: ptBR });
}

export function formatShort(iso: string): string {
  return format(parseISO(iso), "dd/MM", { locale: ptBR });
}

export const WEEKDAY_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
