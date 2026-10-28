import { z } from "zod";
/** Shared persistence/transport proof boundary, never interpret notes or prose as proof. */
export const taskProof = z.object({
 task_execution: z.literal(true), verified: z.literal(true),
 task_id: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
 response_text: z.string().max(24000).refine(s => s.trim().length > 0),
 session_id: z.string().min(1).max(200).optional(),
 evidence: z.array(z.string().min(1).max(2000)).max(12).optional(),
});
