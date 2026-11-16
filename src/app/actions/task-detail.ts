"use server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { getTask } from "@/server/tasks";

export async function loadTaskDetail(id: string, scope: "pessoal" | "empresa") {
  await requireAuth();
  return getTask(z.uuid().parse(id), z.enum(["pessoal", "empresa"]).parse(scope));
}
