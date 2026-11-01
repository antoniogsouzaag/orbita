import "server-only";
import { z } from "zod";
import { crmCall, crmConfigured } from "./crm";
import { feedbackInput, feedbackListSchema, FEEDBACK_STATUSES, type FeedbackItem, type FeedbackStatus } from "@/lib/crm-feedback";

export type FeedbackResult =
  | { status: "ok"; items: FeedbackItem[]; checkedAt: string }
  | { status: "not_configured" | "unavailable"; items: []; checkedAt: string; message: string };

export async function crmFeedback(input: z.input<typeof feedbackInput> = {}): Promise<FeedbackResult> {
  const checkedAt = new Date().toISOString();
  if (!crmConfigured()) return { status: "not_configured", items: [], checkedAt, message: "CRM não conectado. Configure CRM_MCP_URL e CRM_MCP_TOKEN." };
  const args = feedbackInput.parse(input);
  try {
    const data = feedbackListSchema.parse(await crmCall("crm_feedback", args));
    if ((args.produto ?? null) !== data.produto || (args.status ?? null) !== data.status) throw new Error("filtro divergente");
    return { status: "ok", items: data.feedbacks, checkedAt };
  } catch {
    return { status: "unavailable", items: [], checkedAt, message: "Consulta ao CRM indisponível ou versão sem crm_feedback. Nenhuma ausência de feedback foi presumida." };
  }
}

export async function setCrmFeedbackStatus(id: string, status: FeedbackStatus) {
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(FEEDBACK_STATUSES) }).parse({ id, status });
  await crmCall("crm_atualizar_feedback", { feedback_id: parsed.id, status: parsed.status });
  notificationFeedback = null;
}

// Bounded polling cache shared by notification requests; never part of shell rendering.
let notificationFeedback: { expires: number; promise: Promise<FeedbackResult> } | null = null;
export function feedbackForNotifications(): Promise<FeedbackResult> {
  if (!notificationFeedback || notificationFeedback.expires <= Date.now()) {
    notificationFeedback = { expires: Date.now() + 30_000, promise: crmFeedback({ status: "novo", limite: 30 }) };
  }
  return notificationFeedback.promise;
}
