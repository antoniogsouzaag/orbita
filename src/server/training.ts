import "server-only";
import { asc, like } from "drizzle-orm";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { trainingPlanSchema, type TrainingPlan } from "@/lib/training";

export async function listTrainingPlans(): Promise<TrainingPlan[]> {
  const db = await getDb();
  const rows = await db.select().from(settings).where(like(settings.key, "training-plan:%")).orderBy(asc(settings.key));
  return rows.flatMap((row) => {
    const parsed = trainingPlanSchema.safeParse(row.value);
    return parsed.success ? [{ ...parsed.data, id: row.key.slice("training-plan:".length) }] : [];
  });
}
