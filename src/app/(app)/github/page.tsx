import { Suspense } from "react";
import { GitFork } from "lucide-react";
import { GithubDashboard } from "@/components/agents/github-dashboard";
import { PageHeader } from "@/components/ui/card";
import { githubActivity } from "@/server/github";
import { githubInbox } from "@/server/github-inbox";
export const metadata = { title: "GitHub" };
export default function Page() {
  return <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6"><PageHeader icon={<GitFork />} title="GitHub" description="Contribuições, revisões e propostas do ecossistema." /><Suspense fallback={<div role="status" className="loading-shimmer rounded-xl border border-border p-5 text-sm text-muted">Consultando GitHub…</div>}><Dashboard /></Suspense></div>;
}
async function Dashboard() {
  const [activity, inbox] = await Promise.all([githubActivity(), githubInbox()]);
  return <GithubDashboard activity={activity} inbox={inbox} />;
}
