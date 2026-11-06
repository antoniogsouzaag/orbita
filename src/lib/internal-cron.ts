/** Mesmos horários do vercel.json (UTC). Fora da Vercel, o agendador interno chama as rotas nesses horários. */
export const INTERNAL_CRONS = [
  { path: "/api/cron/redes", hour: 3, minute: 15 },
  { path: "/api/cron/orbe", hour: 6, minute: 0 },
  { path: "/api/cron/midia", hour: 7, minute: 30 },
  { path: "/api/cron/brief", hour: 10, minute: 0 },
] as const;

/** Rotas que vencem neste minuto e ainda não rodaram hoje (chave = rota + dia UTC). */
export function dueCrons(now: Date, ran: Set<string>) {
  const day = now.toISOString().slice(0, 10);
  return INTERNAL_CRONS.filter(c => now.getUTCHours() === c.hour && now.getUTCMinutes() >= c.minute && now.getUTCMinutes() < c.minute + 5 && !ran.has(`${c.path}@${day}`))
    .map(c => ({ path: c.path, key: `${c.path}@${day}` }));
}
