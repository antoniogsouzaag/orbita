"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { FEEDBACK_STATUSES, feedbackItemSchema, feedbackTaskNotes, feedbackTaskTitle } from "@/lib/crm-feedback";
import { setCrmFeedbackStatus } from "@/server/crm-feedback";
import { insertTask } from "@/server/task-write";

export async function updateFeedbackStatus(id: string, status: (typeof FEEDBACK_STATUSES)[number]) {
  await requireAuth();
  await setCrmFeedbackStatus(id, z.enum(FEEDBACK_STATUSES).parse(status));
  revalidatePath("/empresa/feedback");
}

/** Cria uma tarefa da empresa a partir do feedback e marca o feedback como lido no CRM. */
export async function feedbackToTask(raw: unknown) {
  await requireAuth();
  const item = feedbackItemSchema.parse(raw);
  const id = await insertTask({
    title: feedbackTaskTitle(item),
    notes: feedbackTaskNotes(item),
    scope: "empresa",
    priority: 2,
    tags: ["feedback", `produto:${item.produto}`.slice(0, 40)],
  });
  if (item.status === "novo") await setCrmFeedbackStatus(item.id, "lido").catch(() => undefined);
  revalidatePath("/empresa/feedback");
  return id;
}
