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
    <PageHeader icon={<GitFork />} title="GitHub" description={`Contribuições${activity.user ? ` de ${activity.user}` : ""}, PRs e propostas da ${inbox.org}.`} />
    {activity.error ? <Card className="p-5 text-sm text-muted">{activity.error}</Card> : <GitHubActivityGrid days={activity.days} />}
    <GithubInbox initial={inbox} />
  </div>;
}
