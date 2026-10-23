import "server-only";
import { aiEnabled } from "@/server/ai";
import { listGoals } from "@/server/goals";
import { eventsBetween, syncStaleCalendars } from "@/server/calendar";
import { getCheckin } from "@/server/checkins";
import { commitStreak } from "@/server/github";
import { habitLogDates, listHabits } from "@/server/habits";
import { financeMonth, focusStats, getDayPlan, listBooks, listWorkouts } from "@/server/life";
import { getSettings } from "@/server/settings";
import { completedOnDays, homeTasks, taskCounts } from "@/server/tasks";
import { WEEKDAY_SHORT, lastNDays, localHour, localTime, relativeDay, shiftDate, startOfWeekISO, today, zonedToUtc, localDate } from "@/lib/dates";
import { dayStreak, nextMilestone } from "@/lib/habits";
import { greeting } from "@/lib/greeting";
import { AREA_LABEL } from "@/lib/utils";

const QUOTES = [
  "A mente que se abre a um novo saber nunca mais retorna ao seu tamanho original.",
  "Disciplina é escolher entre o que você quer agora e o que você mais quer.",
  "Pequenos passos todos os dias somam grandes distâncias.",
  "O sucesso é a soma de pequenos esforços repetidos dia após dia.",
  "Feito é melhor que perfeito.",
  "Você não sobe ao nível das suas metas, cai ao nível dos seus sistemas.",
  "Consistência vence intensidade.",
];

const AREA_STREAK_LABEL: Record<string, { label: string; emoji: string; color: string }> = {
  pessoal: { label: "Rotina & Vida", emoji: "🌱", color: "#22c55e" },
  empresa: { label: "Cockpit AG LABS", emoji: "🚀", color: "#22d3ee" },
  estudos: { label: "Estudos & Mente", emoji: "🎓", color: "#f59e0b" },
  saude: { label: "Corpo & Saúde", emoji: "💪", color: "#fb7185" },
  financas: { label: "Finanças em dia", emoji: "💰", color: "#a78bfa" },
};

export type StreakCard = {
  key: string;
  label: string;
  emoji: string;
  color: string;
  streak: number;
  week: { label: string; date: string; done: boolean; isToday: boolean; future: boolean }[];
  next: number;
  quote: string;
  href: string;
};

/** Agenda agrupada por dia (próximos compromissos), usada no Início pessoal e no da Empresa. */
export function groupAgenda(events: Awaited<ReturnType<typeof eventsBetween>>, now: Date, t: string) {
  const upcoming = events.filter((e) => e.endAt > now);
  const agenda = new Map<string, { label: string; items: { id: string; title: string; time: string; until: string; color: string; allDay: boolean }[] }>();
  for (const e of upcoming) {
    const d = e.allDay ? e.startAt.toISOString().slice(0, 10) : localDate(e.startAt);
    const key = d < t ? t : d;
    if (!agenda.has(key)) agenda.set(key, { label: relativeDay(key).toUpperCase(), items: [] });
    agenda.get(key)!.items.push({ id: e.id, title: e.title, time: e.allDay ? "Dia todo" : localTime(e.startAt), until: e.allDay ? "" : `até ${localTime(e.endAt)}`, color: e.color, allDay: e.allDay });
  }
  return [...agenda.entries()].slice(0, 5).map(([date, v]) => ({ date, ...v }));
}

export async function loadHome() {
  syncStaleCalendars(60).catch(() => {});
  const t = today();
  const now = new Date();
  const [settings, counts, tasks, habits, goals, events, checkin, plan, focus, workouts, finance, books, logs, completions, commits] = await Promise.all([
    getSettings(),
    taskCounts(),
    homeTasks(7),
    listHabits({ days: 400 }),
    listGoals("ativa"),
    eventsBetween(zonedToUtc(t), zonedToUtc(shiftDate(t, 8))),
    getCheckin(t),
    getDayPlan(t),
    focusStats(),
    listWorkouts(1),
    financeMonth(),
    listBooks(),
    habitLogDates(shiftDate(t, -400)),
    completedOnDays(shiftDate(t, -400)),
    commitStreak(),
  ]);

  // Sequências por área + sequência geral da Órbita
  const byArea = new Map<string, Set<string>>();
  const all = new Set<string>();
  for (const l of logs) {
    if (!byArea.has(l.area)) byArea.set(l.area, new Set());
    byArea.get(l.area)!.add(l.date);
    all.add(l.date);
  }
  for (const c of completions) if (c.completedAt) all.add(localDate(c.completedAt));
  const weekStart = startOfWeekISO(t);
  const week = (set: Set<string>) =>
    lastNDays(7, shiftDate(weekStart, 6)).map((d) => ({ label: WEEKDAY_SHORT[new Date(`${d}T12:00:00Z`).getUTCDay()], date: d, done: set.has(d), isToday: d === t, future: d > t }));
  const seed = Number(t.replace(/-/g, ""));
  const cards: StreakCard[] = [
    { key: "orbita", label: "Cockpit Órbita", emoji: "🛰️", color: "#22d3ee", set: all, href: "/revisao" },
    ...[...byArea.entries()].map(([area, set]) => ({ key: area, ...(AREA_STREAK_LABEL[area] ?? { label: AREA_LABEL[area] ?? area, emoji: "✨", color: "#a78bfa" }), set, href: "/habitos" })),
  ].map((c, i) => {
    const streak = dayStreak(c.set, t);
    return { key: c.key, label: c.label, emoji: c.emoji, color: c.color, streak, week: week(c.set), next: nextMilestone(streak), quote: QUOTES[(seed + i) % QUOTES.length], href: c.href };
  });

  const upcoming = events.filter((e) => e.endAt > now);
  const agenda = groupAgenda(events, now, t);
  // Subtítulo do herói
  const next = upcoming.find((e) => !e.allDay && e.startAt > now && e.startAt.getTime() - now.getTime() < 36 * 3_600_000);
  const scheduled = habits.filter((h) => h.scheduledToday);
  const pendingHabits = scheduled.filter((h) => !h.doneToday).length;
  const hour = localHour();
  let subtitle: { text: string; tone?: "warning" } = { text: `${counts.open} tarefas abertas` };
  if (next) subtitle = { text: `Próximo: ${next.title} · ${relativeDay(localDate(next.startAt))} ${localTime(next.startAt)}` };
  else if (counts.overdue > 0) subtitle = { text: `⚠ ${counts.overdue} ${counts.overdue === 1 ? "tarefa atrasada" : "tarefas atrasadas"}`, tone: "warning" };
  else if (hour >= 17 && pendingHabits > 0) subtitle = { text: `Faltam ${pendingHabits} ${pendingHabits === 1 ? "hábito" : "hábitos"} hoje` };
  else if (commits && commits > 1) subtitle = { text: `🔥 ${commits} dias seguidos de commits` };

  return {
    settings,
    title: greeting(settings.name, hour, t),
    subtitle,
    counts,
    tasks,
    habits: [...scheduled, ...habits.filter((h) => !h.scheduledToday)],
    habitsDone: scheduled.filter((h) => h.doneToday).length,
    habitsTotal: scheduled.length,
    goals,
    agenda,
    checkin,
    plan,
    focus: { week: focus.week, today: focus.today, avgDaily: focus.avgDaily },
    lastWorkout: workouts[0] ?? null,
    finance: { income: finance.income, expense: finance.expense, balance: finance.balance, top: finance.categories[0] ?? null },
    books: books.filter((b) => b.status === "lendo"),
    cards,
    aiEnabled: aiEnabled(),
  };
}

export type HomeData = Awaited<ReturnType<typeof loadHome>>;
