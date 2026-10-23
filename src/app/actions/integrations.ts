"use server";

import { requireAuth } from "@/lib/auth";
import { githubInbox } from "@/server/github-inbox";
import { checkIntegrationHealth } from "@/server/integrations";

export async function checkIntegrationsAction() {
  await requireAuth();
  return checkIntegrationHealth();
}

export async function refreshGithubInboxAction() {
  await requireAuth();
  return githubInbox({ force: true });
}
