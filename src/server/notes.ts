import "server-only";
import { desc, eq, ilike, or } from "drizzle-orm";
import { getDb } from "@/db";
import { notes } from "@/db/schema";

export async function listNotes(q?: string) {
  const db = await getDb();
  return db
    .select()
    .from(notes)
    .where(q ? or(ilike(notes.title, `%${q}%`), ilike(notes.content, `%${q}%`)) : undefined)
    .orderBy(desc(notes.pinned), desc(notes.updatedAt))
    .limit(300);
}

export async function getNote(id: string) {
  const db = await getDb();
  const [n] = await db.select().from(notes).where(eq(notes.id, id));
  return n ?? null;
}
