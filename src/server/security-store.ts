import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { settings } from "@/db/schema";

export async function getRawSetting(key: string): Promise<unknown> {
  const db = await getDb();
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  return row?.value;
}

export async function setRawSetting(key: string, value: unknown) {
  const db = await getDb();
  await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}
