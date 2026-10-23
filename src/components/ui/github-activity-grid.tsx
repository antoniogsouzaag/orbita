import type { ActivityDay } from "@/server/github";

const colors = ["bg-surface-3", "bg-emerald-500/20", "bg-emerald-500/40", "bg-emerald-500/70", "bg-emerald-400"];
const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Referência adaptada sem dados simulados ou dependência de animação. */
export function GitHubActivityGrid({ days }: { days: ActivityDay[] }) {
  if (!days.length) return null;
  const max = Math.max(1, ...days.map((day) => day.count));
  const padding = new Date(`${days[0].date}T12:00:00Z`).getUTCDay();
  const cells: (ActivityDay | null)[] = [...Array<null>(padding).fill(null), ...days];
  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  return <section className="rounded-2xl border border-border bg-surface p-5" aria-label="Calendário de contribuições GitHub">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm"><strong>{days.reduce((sum, day) => sum + day.count, 0).toLocaleString("pt-BR")}</strong> <span className="text-muted">contribuições no período</span></p>
      <div className="flex items-center gap-1 text-[10px] text-muted" aria-hidden="true">Menos {colors.map((color) => <span key={color} className={`size-2.5 rounded-sm ${color}`} />)} Mais</div>
    </div>
    <div className="overflow-x-auto pb-2"><div className="flex min-w-max gap-[3px]">
      {weeks.map((week, index) => {
        const first = week.find((day) => day && new Date(`${day.date}T12:00:00Z`).getUTCDate() <= 7);
        return <div key={index} className="relative flex flex-col gap-[3px] pt-5">
          {first && <span className="absolute top-0 text-[9px] text-faint">{months[new Date(`${first.date}T12:00:00Z`).getUTCMonth()]}</span>}
          {week.map((day, i) => day ? <span key={day.date} tabIndex={0} title={`${day.count} contribuições · ${day.date}`} aria-label={`${day.count} contribuições em ${day.date}`} className={`block size-[11px] rounded-[3px] outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent ${colors[day.count <= 0 ? 0 : Math.min(4, Math.ceil(day.count / max * 4))]}`} /> : <span key={`pad-${i}`} className="size-[11px]" />)}
        </div>;
      })}
    </div></div>
    <p className="mt-3 text-[11px] text-faint">{days[0].date} a {days.at(-1)?.date} · Fonte: GitHub · cache de até 1 hora. Inclui commits, PRs, issues e revisões visíveis à credencial.</p>
  </section>;
}
