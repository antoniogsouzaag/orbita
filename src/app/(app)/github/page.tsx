import { GitFork } from "lucide-react";
import { GithubInbox } from "@/components/agents/github-inbox";
import { GitHubActivityGrid } from "@/components/ui/github-activity-grid";
import { Card, PageHeader } from "@/components/ui/card";
import { githubActivity } from "@/server/github";
import { githubInbox } from "@/server/github-inbox";

export const metadata = { title: "GitHub" };
export default async function Page() {
  const [inbox, activity] = await Promise.all([githubInbox(), githubActivity()]);
  return <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
    <PageHeader icon={<GitFork />} title="GitHub" description={`Contribuições${activity.user ? ` de ${activity.user}` : ""}, seu fluxo de revisão e propostas da ${inbox.org}.`} actions={<a href={`https://github.com/${activity.user || inbox.org}`} target="_blank" rel="noopener noreferrer" className="rounded-full border border-border px-4 py-2 text-xs text-muted transition hover:bg-surface-2 hover:text-fg">Abrir GitHub ↗</a>} />
    {activity.error ? <Card className="p-5 text-sm text-muted">{activity.error}</Card> : <GitHubActivityGrid days={activity.days} />}
    <GithubInbox initial={inbox} />
  </div>;
}
