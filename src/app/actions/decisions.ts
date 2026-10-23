"use server";
import { requireAuth } from "@/lib/auth";
import { suggestNextAction } from "@/server/decisions";

export async function suggestNextActionAction() {
  await requireAuth();
  return suggestNextAction();
}
