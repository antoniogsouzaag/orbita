import "server-only";
import { unstable_cache } from "next/cache";
import { today } from "@/lib/dates";
import { dayStreak } from "@/lib/habits";

/** Sequência de dias com contribuições no GitHub (opcional: GITHUB_TOKEN + GITHUB_USER). */
export const commitStreak = unstable_cache(
  async (): Promise<number | null> => {
    const token = process.env.GITHUB_TOKEN ?? process.env.VAULT_GITHUB_TOKEN;
    const user = process.env.GITHUB_USER;
    if (!token || !user) return null;
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
      if (!res.ok) return null;
      const json = await res.json();
      const days: { date: string; contributionCount: number }[] =
        json?.data?.user?.contributionsCollection?.contributionCalendar?.weeks?.flatMap((w: { contributionDays: unknown[] }) => w.contributionDays) ?? [];
      const active = new Set(days.filter((d) => d.contributionCount > 0).map((d) => d.date));
      return dayStreak(active, today());
    } catch {
      return null;
    }
  },
  ["commit-streak"],
  { revalidate: 3600 },
);
