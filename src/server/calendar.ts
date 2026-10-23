import "server-only";
import { and, asc, eq, gte, isNull, lt, or } from "drizzle-orm";
import ical, { type EventInstance, type VEvent } from "node-ical";
import { getDb } from "@/db";
import { calendars, events } from "@/db/schema";

export type EventRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  color: string;
  calendarId: string | null;
  calendarName: string;
  editable: boolean;
};

export async function eventsBetween(from: Date, to: Date): Promise<EventRow[]> {
  const db = await getDb();
  const rows = await db
    .select({ e: events, c: { id: calendars.id, name: calendars.name, color: calendars.color, kind: calendars.kind, enabled: calendars.enabled } })
    .from(events)
    .leftJoin(calendars, eq(events.calendarId, calendars.id))
    .where(and(lt(events.startAt, to), gte(events.endAt, from), or(isNull(events.calendarId), eq(calendars.enabled, true))))
    .orderBy(asc(events.startAt));
  return rows.map(({ e, c }) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    location: e.location,
    startAt: e.startAt,
    endAt: e.endAt,
    allDay: e.allDay,
    color: e.color ?? c?.color ?? "#22c55e",
    calendarId: e.calendarId,
    calendarName: c?.name ?? "Órbita",
    editable: !c || c.kind === "local",
  }));
}

export async function listCalendars() {
  const db = await getDb();
  return db.select().from(calendars).orderBy(asc(calendars.createdAt));
}

/** webcal:// → https:// (links de calendário público do iCloud usam webcal). */
export function normalizeIcsUrl(url: string) {
  return url.trim().replace(/^webcals?:\/\//i, "https://");
}

type ParsedEvent = { uid: string; title: string; description: string | null; location: string | null; startAt: Date; endAt: Date; allDay: boolean };

function pv(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && "val" in (v as object)) return String((v as { val: unknown }).val);
  return String(v);
}

/** Datas "só dia" do ICS chegam como meia-noite local; normaliza para meia-noite UTC. */
function dateOnlyToUtc(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** Expande um ICS em ocorrências dentro da janela [from, to] (recorrências, exceções e overrides). */
export function expandIcs(text: string, from: Date, to: Date): ParsedEvent[] {
  const data = ical.sync.parseICS(text);
  const out: ParsedEvent[] = [];
  for (const raw of Object.values(data)) {
    if (!raw || raw.type !== "VEVENT") continue;
    const ev = raw as VEvent;
    if (!ev.start) continue;
    let instances: EventInstance[] = [];
    try {
      instances = ical.expandRecurringEvent(ev, { from, to, expandOngoing: true });
    } catch {
      continue;
    }
    const uid = String(ev.uid ?? pv(ev.summary));
    for (const inst of instances) {
      const allDay = inst.isFullDay;
      const startAt = allDay ? dateOnlyToUtc(inst.start) : new Date(inst.start);
      let endAt = inst.end ? (allDay ? dateOnlyToUtc(inst.end) : new Date(inst.end)) : new Date(startAt.getTime() + (allDay ? 86_400_000 : 3_600_000));
      if (endAt <= startAt) endAt = new Date(startAt.getTime() + (allDay ? 86_400_000 : 1_800_000));
      out.push({
        uid: inst.isRecurring ? `${uid}:${startAt.toISOString()}` : uid,
        title: pv(inst.summary) ?? pv(inst.event.summary) ?? "(sem título)",
        description: pv(inst.event.description),
        location: pv(inst.event.location),
        startAt,
        endAt,
        allDay,
      });
    }
  }
  return out;
}

export async function syncCalendar(id: string) {
  const db = await getDb();
  const [cal] = await db.select().from(calendars).where(eq(calendars.id, id));
  if (!cal || cal.kind !== "ics" || !cal.url) throw new Error("Calendário não é uma assinatura ICS");
  try {
    const res = await fetch(normalizeIcsUrl(cal.url), { headers: { "user-agent": "Orbita/1.0 (+calendar sync)" }, signal: AbortSignal.timeout(20_000), cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text.includes("BEGIN:VCALENDAR")) throw new Error("A URL não retornou um calendário ICS");
    const now = Date.now();
    const parsed = expandIcs(text, new Date(now - 60 * 86_400_000), new Date(now + 400 * 86_400_000));
    await db.delete(events).where(eq(events.calendarId, id));
    for (let i = 0; i < parsed.length; i += 200) {
      await db.insert(events).values(parsed.slice(i, i + 200).map((p) => ({ ...p, externalUid: p.uid, calendarId: id })));
    }
    await db.update(calendars).set({ lastSyncedAt: new Date(), lastError: null }).where(eq(calendars.id, id));
    return parsed.length;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.update(calendars).set({ lastError: msg.slice(0, 300) }).where(eq(calendars.id, id));
    throw new Error(`Falha ao sincronizar: ${msg}`);
  }
}

/** Sincroniza assinaturas que estão há mais de `maxAgeMin` sem atualizar. */
export async function syncStaleCalendars(maxAgeMin = 30) {
  const cals = await listCalendars();
  const stale = cals.filter((c) => c.kind === "ics" && c.enabled && (!c.lastSyncedAt || Date.now() - c.lastSyncedAt.getTime() > maxAgeMin * 60_000));
  await Promise.allSettled(stale.map((c) => syncCalendar(c.id)));
}

/* ───────── Feed ICS de saída (para assinar no iPhone/Google) ───────── */

function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\;");
}

function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 74) {
    let cut = 74;
    while (Buffer.byteLength(rest.slice(0, cut)) > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const dateStamp = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

export function buildIcs(items: { uid: string; title: string; description?: string | null; location?: string | null; startAt: Date; endAt: Date; allDay: boolean }[], name = "Órbita") {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Orbita//Central operacional//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`,
    "X-PUBLISHED-TTL:PT15M",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
  ];
  const now = stamp(new Date());
  for (const e of items) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}@orbita`, `DTSTAMP:${now}`);
    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(e.startAt)}`, `DTEND;VALUE=DATE:${dateStamp(e.endAt > e.startAt ? e.endAt : new Date(e.startAt.getTime() + 86_400_000))}`);
    } else {
      lines.push(`DTSTART:${stamp(e.startAt)}`, `DTEND:${stamp(e.endAt)}`);
    }
    lines.push(`SUMMARY:${esc(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
