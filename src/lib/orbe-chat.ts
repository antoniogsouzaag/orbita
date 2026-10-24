import { z } from "zod";

export type ChatTurn = { role: "user" | "assistant"; content: string };
export const CHAT_LIMITS = { user: 4000, assistant: 20000, total: 60000, messages: 40 } as const;
const turn = z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(CHAT_LIMITS.assistant) });
export const chatRequestSchema = z.union([
  z.object({ question: z.string().trim().min(1).max(CHAT_LIMITS.user), scope: z.enum(["pessoal", "empresa"]).optional(), readOnly: z.boolean().optional() }),
  z.object({ messages: z.array(turn).min(1).max(CHAT_LIMITS.messages), scope: z.enum(["pessoal", "empresa"]).optional(), readOnly: z.boolean().optional() })
    .refine(v => v.messages.at(-1)?.role === "user" && Boolean(v.messages.at(-1)?.content.trim()), "A última mensagem deve ser sua")
    .refine(v => (v.messages.at(-1)?.content.length ?? 0) <= CHAT_LIMITS.user, "Pergunta muito longa")
    .refine(v => v.messages.reduce((n, m) => n + m.content.length, 0) <= CHAT_LIMITS.total, "Histórico muito longo"),
]);

/** Limite de caracteres, não de tokens. Mantém os turnos mais recentes sem quebrar o pedido atual. */
export function boundedChatHistory<T extends ChatTurn>(messages: T[], limit = 30): T[] {
  const kept: T[] = [];
  let remaining: number = CHAT_LIMITS.total;
  for (const message of messages.slice(-limit).reverse()) {
    const max = message.role === "user" ? CHAT_LIMITS.user : CHAT_LIMITS.assistant;
    const content = message.content.slice(0, max);
    if (content.length > remaining) break;
    kept.unshift({ ...message, content });
    remaining -= content.length;
  }
  while (kept[0]?.role === "assistant") kept.shift();
  return kept;
}
