import { GitPullRequest } from "lucide-react";
import Link from "next/link";
import { GithubInbox } from "@/components/agents/github-inbox";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { githubInbox } from "@/server/github-inbox";

export const metadata = { title: "PRs e propostas" };

export default async function Page() {
  const inbox = await githubInbox();
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
      <PageHeader icon={<GitPullRequest />} title="PRs e propostas" description={`Revisão e decisões da ${inbox.org}, por repositório e autor.`} actions={<Button asChild size="sm" variant="outline"><Link href="/integracoes">Integrações</Link></Button>} />
      <GithubInbox initial={inbox} />
    </div>
  );
}
