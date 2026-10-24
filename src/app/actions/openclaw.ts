"use server";
import { requireAuth } from "@/lib/auth";
import { listDispatches, toView } from "@/server/dispatch";
import { dispatchOpenclaw } from "@/server/openclaw";
export async function sendOpenclaw(input: Parameters<typeof dispatchOpenclaw>[0]) { await requireAuth(); return toView(await dispatchOpenclaw(input)); }
export async function refreshOpenclaw() { await requireAuth(); return (await listDispatches({ target: "openclaw" })).map((row) => toView(row)); }
