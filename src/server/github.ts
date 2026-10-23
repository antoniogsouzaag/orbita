import "server-only";
import { unstable_cache } from "next/cache";
import { today } from "@/lib/dates";
import { dayStreak } from "@/lib/habits";

/** Calendário real de contribuições do GitHub. */
export const githubActivity = unstable_cache(
  async (): Promise<{ days: { date: string; count: number }[]; user: string | null; error: string | null }> => {
    const token = process.env.GITHUB_TOKEN ?? process.env.GITHUB_INBOX_TOKEN ?? process.env.VAULT_GITHUB_TOKEN;
    const user = process.env.GITHUB_USER;
    if (!token || !user) return { days: [], user: user ?? null, error: "Configure GITHUB_USER e uma credencial GitHub para consultar contribuições reais." };
    try {
      const res = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "user-agent": "orbita" },
        body: JSON.stringify({
          query: `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}`,
          variables: { login: user },
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error("GitHub");
      const json = await res.json();
      const days: { date: string; contributionCount: number }[] =
        json?.data?.user?.contributionsCollection?.contributionCalendar?.weeks?.flatMap((w: { contributionDays: unknown[] }) => w.contributionDays) ?? [];
      if (json.errors?.length || !days.length) throw new Error("Calendário indisponível");
      return { days: days.map((d) => ({ date: d.date, count: d.contributionCount })), user, error: null };
    } catch {
      return { days: [], user: user ?? null, error: "Não foi possível consultar as contribuições. Confira usuário e permissões GitHub." };
    }
  },
  ["github-activity"],
  { revalidate: 3600 },
);

export type ActivityDay = { date: string; count: number };
export async function commitStreak(): Promise<number | null> {
  const activity = await githubActivity();
  return activity.error ? null : dayStreak(new Set(activity.days.filter((day) => day.count > 0).map((day) => day.date)), today());
}
