"use server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { clearCrmCache } from "@/server/crm";

export async function refreshBusiness() {
  await requireAuth();
  clearCrmCache();
  revalidatePath("/empresa", "layout");
}
