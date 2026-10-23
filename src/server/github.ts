import "server-only";
import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { today } from "@/lib/dates";
import { dayStreak } from "@/lib/habits";
export type GithubActivity = { days: { date: string; count: number }[]; user: string | null; error: string | null };
async function readActivity(user: string, _credentialHash: string): Promise<GithubActivity> {
  void _credentialHash; // Inclui a identidade da credencial na chave do cache, sem expor o token.
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_INBOX_TOKEN || process.env.VAULT_GITHUB_TOKEN;
  const res = await fetch("https://api.github.com/graphql", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "user-agent": "orbita" }, body: JSON.stringify({ query: "query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}", variables: { login: user } }), signal: AbortSignal.timeout(10000), cache: "no-store" });
  if (!res.ok) throw new Error(res.status === 401 ? "GitHub: credencial inválida ou expirada." : res.status === 403 || res.status === 429 ? "GitHub: consulta limitada. Confira as permissões e o limite da API." : `GitHub: HTTP ${res.status}. Tente atualizar em alguns instantes.`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.some((e: { type?: string }) => e.type === "RATE_LIMITED") ? "GitHub: limite da API atingido. Aguarde antes de atualizar." : "GitHub: confira o usuário e o acesso às contribuições nesta credencial.");
  const days: { date: string; contributionCount: number }[] = json?.data?.user?.contributionsCollection?.contributionCalendar?.weeks?.flatMap((week: { contributionDays: unknown[] }) => week.contributionDays) ?? [];
  if (!days.length) throw new Error("GitHub: calendário não retornado para este usuário.");
  return { days: days.map((day) => ({ date: day.date, count: day.contributionCount })), user, error: null };
}
const cachedActivity = unstable_cache(readActivity, ["github-activity-v2"], { revalidate: 3600 });
/** Só resultados bem-sucedidos entram no cache. A atualização manual ignora o cache. */
export async function githubActivity(options: { force?: boolean } = {}): Promise<GithubActivity> {
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_INBOX_TOKEN || process.env.VAULT_GITHUB_TOKEN;
  const user = process.env.GITHUB_USER?.trim();
  if (!token || !user) return { days: [], user: user ?? null, error: "Configure GITHUB_USER e uma credencial GitHub para consultar contribuições reais." };
  const hash = createHash("sha256").update(token).digest("hex");
  try { return await (options.force ? readActivity(user, hash) : cachedActivity(user, hash)); }
  catch (e) { return { days: [], user, error: e instanceof Error && e.message.startsWith("GitHub:") ? e.message : "Não foi possível consultar as contribuições agora. Tente atualizar." }; }
}
export type ActivityDay = { date: string; count: number };
export async function commitStreak(): Promise<number | null> {
  const activity = await githubActivity();
  return activity.error ? null : dayStreak(new Set(activity.days.filter((day) => day.count > 0).map((day) => day.date)), today());
}
