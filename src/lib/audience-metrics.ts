import { z } from "zod";

const count = z.number().int().nonnegative().safe().nullable();
const engagementCount = z.number().int().nonnegative().safe();
const membersCounts = z.object({ engaged: engagementCount, creating: engagementCount, selling: engagementCount, learning: engagementCount });
export const audienceMetricsSchema = z.object({
  version: z.literal(1),
  active30d: count,
  newMonth: count,
  monthFrom: z.iso.datetime(),
  activityFrom: z.iso.datetime(),
  to: z.iso.datetime(),
  timeZone: z.literal("America/Sao_Paulo"),
  activityBasis: z.literal("authenticated_product_events").nullable(),
  members: z.object({ rolling30d: membersCounts, currentMonth: membersCounts, playbackObservedFrom: z.iso.datetime() }).optional(),
});
export type AudienceMetrics = z.infer<typeof audienceMetricsSchema>;

export function saoPauloMonthStart(at: string | number) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(new Date(at));
  return Date.UTC(Number(parts.find(p => p.type === "year")!.value), Number(parts.find(p => p.type === "month")!.value) - 1, 1, 3);
}

export function validateAudienceMetrics(data: AudienceMetrics, users: number | null, generatedAt: string, product: string) {
  if (data.to !== generatedAt || Date.parse(data.monthFrom) !== saoPauloMonthStart(data.to)
    || Date.parse(data.to) - Date.parse(data.activityFrom) !== 30 * 86_400_000
    || [data.active30d, data.newMonth].some(value => value !== null && (users === null || value > users))
    || (data.active30d !== null) !== (data.activityBasis !== null)) throw new Error("Audiência inválida");
  if (data.members) {
    if (product !== "members" || users === null || data.members.rolling30d.engaged !== data.active30d || Date.parse(data.members.playbackObservedFrom) > Date.parse(data.to)) throw new Error("Engajamento Members inválido");
    for (const row of [data.members.rolling30d, data.members.currentMonth]) {
      if (Object.values(row).some(value => value > users) || row.engaged < Math.max(row.creating, row.selling, row.learning) || row.engaged > row.creating + row.selling + row.learning) throw new Error("União de usuários inválida");
    }
  }
}
