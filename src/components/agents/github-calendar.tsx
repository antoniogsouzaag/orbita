"use client";
import * as React from "react";
import { RefreshCw } from "lucide-react";
import { refreshGithubActivityAction } from "@/app/actions/integrations";
import { GitHubActivityGrid } from "@/components/ui/github-activity-grid";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { GithubActivity } from "@/server/github";
import { toast } from "sonner";

export function GithubCalendar({ initial }: { initial: GithubActivity }) {
  const [activity, setActivity] = React.useState(initial);
  const [pending, start] = React.useTransition();
  return <section className="space-y-3" aria-label="Contribuições"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-medium">Contribuições {activity.user ? `de ${activity.user}` : ""}</h2><Button size="sm" disabled={pending} onClick={() => start(async () => { try { setActivity(await refreshGithubActivityAction()); } catch { toast.error("Falha ao atualizar o calendário."); } })}><RefreshCw className={pending ? "animate-spin" : ""} />Atualizar calendário</Button></div>{activity.error ? <Card className="p-5 text-sm text-warning"><p role="alert">{activity.error}</p></Card> : <GitHubActivityGrid days={activity.days} />}</section>;
}
