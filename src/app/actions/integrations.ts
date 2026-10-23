"use server";

import { requireAuth } from "@/lib/auth";
import { githubInbox } from "@/server/github-inbox";
import { checkIntegrationHealth } from "@/server/integrations";
import { socialOverview } from "@/server/social";
import { z } from "zod";
import { githubActivity } from "@/server/github";

export async function checkIntegrationsAction() {
  await requireAuth();
  return checkIntegrationHealth();
}

export async function refreshGithubInboxAction() {
  await requireAuth();
  return githubInbox({ force: true });
}

export async function refreshGithubActivityAction() {
  await requireAuth();
  return githubActivity({ force: true });
}

export async function refreshSocialAction(channelId?: string, days: 7 | 30 = 7) {
  await requireAuth();
  const id = z.string().max(200).optional().parse(channelId);
  const range = z.union([z.literal(7), z.literal(30)]).parse(days);
  return socialOverview(id, range, true);
}
