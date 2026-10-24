"use client";
import * as React from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { refreshGithubActivityAction, refreshGithubInboxAction } from "@/app/actions/integrations";
import { GitHubActivityGrid } from "@/components/ui/github-activity-grid";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { GithubActivity } from "@/server/github";
import type { GithubInbox as Inbox } from "@/server/github-inbox";
import { GithubInbox, GithubStats } from "./github-inbox";

export function GithubDashboard({ activity: initialActivity, inbox: initialInbox }: { activity: GithubActivity; inbox: Inbox }) {
  const [activity, setActivity] = React.useState(initialActivity);
  const [inbox, setInbox] = React.useState(initialInbox);
  const [pending, start] = React.useTransition();
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-medium">Atividade {activity.user ? `de ${activity.user}` : "do ecossistema"}</h2><Button size="sm" disabled={pending} onClick={() => start(async () => {
      const [calendar, items] = await Promise.allSettled([refreshGithubActivityAction(), refreshGithubInboxAction()]);
      if (calendar.status === "fulfilled") setActivity(calendar.value);
      if (items.status === "fulfilled") setInbox(items.value);
      if (calendar.status === "rejected" || items.status === "rejected") toast.error("Atualização parcial. Mantivemos a última resposta da fonte que falhou.");
    })}><RefreshCw className={pending ? "animate-spin" : ""} />{pending ? "Atualizando…" : "Atualizar GitHub"}</Button></div>
    {activity.error || !activity.days.length ? <Card className="space-y-4 p-5"><p role={activity.error ? "alert" : "status"} className="text-sm text-muted">{activity.error ?? "Sem contribuições disponíveis."}</p><GithubStats data={inbox} /></Card> : <GitHubActivityGrid days={activity.days} summary={<GithubStats data={inbox} />} />}
    <GithubInbox initial={inbox} />
  </div>;
}
