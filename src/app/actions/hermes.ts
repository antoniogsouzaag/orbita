"use server";
import { requireAuth } from "@/lib/auth";
import { dispatchHermes, readHermesResult } from "@/server/hermes";
export async function sendHermes(input: Parameters<typeof dispatchHermes>[0]) { await requireAuth(); return dispatchHermes(input); }
export async function checkHermes(id: string) { await requireAuth(); return readHermesResult(id); }
