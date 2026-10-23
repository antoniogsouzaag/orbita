import "server-only";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { tasks } from "@/db/schema";
import { BARBERIAS, belongsToBarberias } from "@/lib/business";
import { githubInbox } from "@/server/github-inbox";
import { liveOps } from "@/server/ops-live";
import { socialChannels, socialConfigured } from "@/server/social";

export async function barberiasSummary() {
  const [social, github, operation, actionCount] = await Promise.allSettled([
    socialConfigured() ? socialChannels() : Promise.reject(new Error("not configured")),
    githubInbox(),
    liveOps(),
    (async () => {
      const db = await getDb();
      const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(tasks).where(and(isNull(tasks.parentId), ne(tasks.status, "done"), eq(tasks.scope, "empresa"), sql`${BARBERIAS.tag} = any(${tasks.tags})`));
      return row.count;
    })(),
  ]);
  const checks = operation.status === "fulfilled" ? operation.value.status.filter((item) => belongsToBarberias(item.url)) : [];
  return {
    channels: social.status === "fulfilled" ? social.value.filter((item) => item.customer?.id === BARBERIAS.postizGroupId).length : null,
    reviews: github.status === "fulfilled" && github.value.configured && !github.value.error ? github.value.items.filter((item) => item.repo === BARBERIAS.repo).length : null,
    tasks: actionCount.status === "fulfilled" ? actionCount.value : null,
    operation: operation.status === "fulfilled" && checks.length ? { ok: checks.filter((item) => item.ok).length, total: checks.length } : null,
    checkedAt: new Date().toISOString(),
  };
}
