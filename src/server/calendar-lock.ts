import "server-only";
import { eq } from "drizzle-orm";
import { withDbTransaction } from "@/db";
import { calendarWriteLock } from "@/db/schema";
export type CalendarTx = Parameters<Parameters<typeof withDbTransaction>[0]>[0];
/** Every calendar/event/appointment writer must enter this transaction first. */
export async function withCalendarTransaction<T>(run: (tx: CalendarTx) => Promise<T>) {
  return withDbTransaction(async tx => {
    await tx.insert(calendarWriteLock).values({ key: 1 }).onConflictDoNothing();
    await tx.select().from(calendarWriteLock).where(eq(calendarWriteLock.key, 1)).for("update");
    return run(tx);
  });
}
