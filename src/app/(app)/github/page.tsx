import { Suspense } from "react";
import { GitFork } from "lucide-react";
import { GithubInbox } from "@/components/agents/github-inbox";
import { GithubCalendar } from "@/components/agents/github-calendar";
import { PageHeader } from "@/components/ui/card";
import { githubActivity } from "@/server/github";
import { githubInbox } from "@/server/github-inbox";
export const metadata = { title: "GitHub" };
export default function Page() {
  return <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6"><PageHeader icon={<GitFork />} title="GitHub" description="Contribuições, revisões e propostas do ecossistema." /><Suspense fallback={<Loading label="Consultando contribuições…" />}><Activity /></Suspense><Suspense fallback={<Loading label="Consultando PRs e propostas…" />}><Inbox /></Suspense></div>;
}
function Loading({ label }: { label: string }) { return <div role="status" className="loading-shimmer rounded-xl border border-border p-5 text-sm text-muted">{label}</div>; }
async function Activity() { return <GithubCalendar initial={await githubActivity()} />; }
async function Inbox() { return <GithubInbox initial={await githubInbox()} />; }
